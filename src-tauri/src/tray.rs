use crate::config::{save_settings, AppSettings};
use std::sync::{Arc, Mutex};
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Listener, Manager};

fn toggle_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(true) {
            let _ = win.hide();
            if let Some(settings) = app.get_webview_window("settings") {
                let _ = settings.hide();
            }
        } else {
            let _ = win.show();
        }
    }
}

pub fn setup_tray(app: &AppHandle, settings: Arc<Mutex<AppSettings>>) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle_show", "显示 / 隐藏小猫", true, None::<&str>)?;
    let initial_locked = settings
        .lock()
        .map(|s| s.click_through_locked)
        .unwrap_or(false);
    let lock_through = CheckMenuItem::with_id(
        app,
        "toggle_lock_through",
        "锁定鼠标穿透（Alt 解锁）",
        true,
        initial_locked,
        None::<&str>,
    )?;
    let open_menu = MenuItem::with_id(app, "open_menu", "设置…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[&toggle, &lock_through, &open_menu, &sep, &quit])?;
    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;

    let sync_lock = lock_through.clone();
    app.listen("cat-settings", move |event| {
        if let Ok(s) = serde_json::from_str::<AppSettings>(event.payload()) {
            let _ = sync_lock.set_checked(s.click_through_locked);
        }
    });

    let tray_settings = settings.clone();
    let event_lock = lock_through.clone();
    TrayIconBuilder::with_id("cat-tray")
        .icon(icon)
        .tooltip("7paws")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        })
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "toggle_show" => toggle_window(app),
            "toggle_lock_through" => {
                let mut s = tray_settings.lock().unwrap();
                s.click_through_locked = !s.click_through_locked;
                let locked = s.click_through_locked;
                save_settings(&s);
                let out = s.clone();
                drop(s);
                let _ = event_lock.set_checked(locked);
                let _ = app.emit("cat-settings", out);
            }
            "open_menu" => crate::show_settings_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
