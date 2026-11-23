use crate::config::AppSettings;
use crate::keymap;
use serde::Serialize;
use std::sync::mpsc;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CatInput {
    KeyDown {
        code: String,
        repeat: bool,
    },
    KeyUp {
        code: String,
    },
    MouseDown {
        button: String,
    },
    MouseUp {
        button: String,
    },
    MouseMoved {
        nx: f64,
        ny: f64,
    },
    PrivacyTap {
        side: String,
    },
}

enum RawHookMsg {
    KeyDown {
        vk: u32,
        scan: u32,
        extended: bool,
    },
    KeyUp {
        vk: u32,
        scan: u32,
        extended: bool,
    },
    MouseDown(&'static str),
    MouseUp(&'static str),
    MouseMoved { x: i32, y: i32 },
}

static HOOK_TX: OnceLock<mpsc::Sender<RawHookMsg>> = OnceLock::new();

pub fn start_global_hooks(app: AppHandle, settings: Arc<Mutex<AppSettings>>) {
    let (tx, rx) = mpsc::channel::<RawHookMsg>();
    let _ = HOOK_TX.set(tx);

    std::thread::spawn(move || {
        let mut pressed = [false; 1024];
        let mut pressed_at: [Instant; 1024] = [Instant::now(); 1024];
        let mut last_mouse_emit = Instant::now() - Duration::from_secs(1);

        while let Ok(msg) = rx.recv() {
            match msg {
                RawHookMsg::KeyDown {
                    vk,
                    scan,
                    extended,
                } => {
                    let privacy = settings
                        .lock()
                        .map(|s| s.privacy_mode)
                        .unwrap_or(false);
                    let idx = (vk as usize) % 1024;
                    let now = Instant::now();
                    let repeat = pressed[idx]
                        && now.duration_since(pressed_at[idx]) < Duration::from_secs(2);
                    if !repeat {
                        pressed[idx] = true;
                        pressed_at[idx] = now;
                    }
                    let code = keymap::code_for(vk, scan, extended);
                    if privacy {
                        if !repeat && code != "Unidentified" {
                            let side = if keymap::is_left_hand(code) {
                                "Left"
                            } else {
                                "Right"
                            };
                            let _ = app.emit(
                                "cat-input",
                                CatInput::PrivacyTap {
                                    side: side.to_string(),
                                },
                            );
                        }
                    } else {
                        let _ = app.emit(
                            "cat-input",
                            CatInput::KeyDown {
                                code: code.to_string(),
                                repeat,
                            },
                        );
                    }
                }
                RawHookMsg::KeyUp {
                    vk,
                    scan,
                    extended,
                } => {
                    let privacy = settings
                        .lock()
                        .map(|s| s.privacy_mode)
                        .unwrap_or(false);
                    let idx = (vk as usize) % 1024;
                    pressed[idx] = false;
                    if !privacy {
                        let code = keymap::code_for(vk, scan, extended);
                        let _ = app.emit(
                            "cat-input",
                            CatInput::KeyUp {
                                code: code.to_string(),
                            },
                        );
                    }
                }
                RawHookMsg::MouseDown(btn) => {
                    let _ = app.emit(
                        "cat-input",
                        CatInput::MouseDown {
                            button: btn.to_string(),
                        },
                    );
                }
                RawHookMsg::MouseUp(btn) => {
                    let _ = app.emit(
                        "cat-input",
                        CatInput::MouseUp {
                            button: btn.to_string(),
                        },
                    );
                }
                RawHookMsg::MouseMoved { x, y } => {
                    let now = Instant::now();
                    if now.duration_since(last_mouse_emit) >= Duration::from_millis(16) {
                        last_mouse_emit = now;
                        let (nx, ny) = normalize_window_point(&app, x, y);
                        let _ = app.emit("cat-input", CatInput::MouseMoved { nx, ny });
                    }
                }
            }
        }
    });

    #[cfg(windows)]
    std::thread::spawn(run_windows_hook_loop);
}

#[cfg(windows)]
fn normalize_window_point(app: &AppHandle, x: i32, y: i32) -> (f64, f64) {
    if let Some(win) = app.get_webview_window("main") {
        if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
            let w = size.width.max(1) as f64;
            let h = size.height.max(1) as f64;
            return ((x - pos.x) as f64 / w, (y - pos.y) as f64 / h);
        }
    }
    (0.5, 0.5)
}

#[cfg(not(windows))]
fn normalize_window_point(_app: &AppHandle, _x: i32, _y: i32) -> (f64, f64) {
    (0.5, 0.5)
}

#[cfg(windows)]
unsafe extern "system" fn keyboard_hook_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    if code >= 0 {
        let kb = &*(lparam as *const KBDLLHOOKSTRUCT);
        let msg = wparam as u32;
        let extended = (kb.flags & 0x01) != 0;
        if let Some(tx) = HOOK_TX.get() {
            match msg {
                WM_KEYDOWN | WM_SYSKEYDOWN => {
                    let _ = tx.send(RawHookMsg::KeyDown {
                        vk: kb.vkCode,
                        scan: kb.scanCode,
                        extended,
                    });
                }
                WM_KEYUP | WM_SYSKEYUP => {
                    let _ = tx.send(RawHookMsg::KeyUp {
                        vk: kb.vkCode,
                        scan: kb.scanCode,
                        extended,
                    });
                }
                _ => {}
            }
        }
    }
    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

#[cfg(windows)]
unsafe extern "system" fn mouse_hook_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, MSLLHOOKSTRUCT, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN,
        WM_MBUTTONUP, WM_MOUSEMOVE, WM_RBUTTONDOWN, WM_RBUTTONUP,
    };

    if code >= 0 {
        let ms = &*(lparam as *const MSLLHOOKSTRUCT);
        let msg = wparam as u32;
        if let Some(tx) = HOOK_TX.get() {
            match msg {
                WM_MOUSEMOVE => {
                    let _ = tx.send(RawHookMsg::MouseMoved {
                        x: ms.pt.x,
                        y: ms.pt.y,
                    });
                }
                WM_LBUTTONDOWN => {
                    let _ = tx.send(RawHookMsg::MouseDown("left"));
                }
                WM_LBUTTONUP => {
                    let _ = tx.send(RawHookMsg::MouseUp("left"));
                }
                WM_RBUTTONDOWN => {
                    let _ = tx.send(RawHookMsg::MouseDown("right"));
                }
                WM_RBUTTONUP => {
                    let _ = tx.send(RawHookMsg::MouseUp("right"));
                }
                WM_MBUTTONDOWN => {
                    let _ = tx.send(RawHookMsg::MouseDown("middle"));
                }
                WM_MBUTTONUP => {
                    let _ = tx.send(RawHookMsg::MouseUp("middle"));
                }
                _ => {}
            }
        }
    }
    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

#[cfg(windows)]
fn run_windows_hook_loop() {
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, MSG, WH_KEYBOARD_LL, WH_MOUSE_LL,
    };

    unsafe {
        let hmod = GetModuleHandleW(std::ptr::null());
        let kb_hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), hmod, 0);
        let ms_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), hmod, 0);

        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {}

        if !kb_hook.is_null() {
            UnhookWindowsHookEx(kb_hook);
        }
        if !ms_hook.is_null() {
            UnhookWindowsHookEx(ms_hook);
        }
    }
}