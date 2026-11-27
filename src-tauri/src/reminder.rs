use crate::main_window_rect;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Size, WebviewUrl,
    WebviewWindowBuilder,
};

const BUBBLE_WIDTH: f64 = 240.0;
const BUBBLE_HEIGHT: f64 = 96.0;

static LATEST_TEXT: Mutex<Option<String>> = Mutex::new(None);
static CREATE_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub(crate) fn show_reminder_bubble(app: AppHandle, text: String) {
    let text: String = text.trim().chars().take(120).collect();
    if text.is_empty() || !crate::main_window_is_visible(&app) {
        return;
    }
    if let Ok(mut latest) = LATEST_TEXT.lock() {
        *latest = Some(text.clone());
    }
    if let Some(win) = app.get_webview_window("reminder") {
        let _ = app.emit_to("reminder", "reminder-bubble", text);
        let _ = win.show();
        return;
    }
    std::thread::spawn(move || {
        let Ok(_guard) = CREATE_LOCK.try_lock() else {
            return;
        };
        build_bubble(&app);
    });
}

#[tauri::command]
pub(crate) fn get_reminder_text() -> Option<String> {
    LATEST_TEXT.lock().ok().and_then(|text| text.clone())
}

#[tauri::command]
pub(crate) fn show_reminder_bubble_ready(app: AppHandle, width: f64, height: f64) {
    let Some(win) = app.get_webview_window("reminder") else {
        return;
    };
    let width = if width.is_finite() {
        width.clamp(160.0, 360.0)
    } else {
        BUBBLE_WIDTH
    };
    let height = if height.is_finite() {
        height.clamp(40.0, 420.0)
    } else {
        BUBBLE_HEIGHT
    };
    let _ = win.set_size(Size::Logical(LogicalSize::new(width, height)));
    let sf = app
        .get_webview_window("main")
        .and_then(|pet| pet.scale_factor().ok())
        .unwrap_or(1.0);
    if let Some((x, y)) = bubble_position(&app, width, height, sf) {
        // Screen points avoid applying another display's scale.
        #[cfg(target_os = "macos")]
        let position = PhysicalPosition::new(x, y).to_logical::<f64>(sf);
        #[cfg(not(target_os = "macos"))]
        let position = PhysicalPosition::new(x, y);
        let _ = win.set_position(position);
        #[cfg(all(windows, feature = "win7"))]
        crate::win7::set_window_position(&win, x, y);
    }
    let _ = win.set_ignore_cursor_events(true);
    let _ = win.show();
}

#[tauri::command]
pub(crate) fn close_reminder_bubble(app: AppHandle) {
    if let Some(win) = app.get_webview_window("reminder") {
        let _ = win.destroy();
    }
}

fn build_bubble(app: &AppHandle) {
    if app.get_webview_window("reminder").is_some() {
        return;
    }
    let built = WebviewWindowBuilder::new(app, "reminder", WebviewUrl::App("reminder.html".into()))
        .title("7paws 提醒")
        .inner_size(BUBBLE_WIDTH, BUBBLE_HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(cfg!(not(all(windows, feature = "win7"))))
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .focusable(false)
        .visible(false)
        // Must match the main window: WebView2 shares one browser environment.
        .additional_browser_args(crate::BROWSER_ARGS)
        .build();
    match built {
        Ok(win) => {
            #[cfg(target_os = "macos")]
            let _ = crate::macos_window::configure_spaces(&win);
            #[cfg(not(target_os = "macos"))]
            let _ = win;
        }
        Err(error) => eprintln!("failed to open reminder bubble: {error}"),
    }
}

fn bubble_position(app: &AppHandle, width: f64, height: f64, sf: f64) -> Option<(i32, i32)> {
    let (pet_x, pet_y, pet_w, pet_h) = main_window_rect(app)?;
    let bubble_w = (width * sf).round() as i32;
    let bubble_h = (height * sf).round() as i32;
    let gap = (8.0 * sf).round() as i32;
    let mut x = pet_x + (pet_w - bubble_w) / 2;
    let mut y = pet_y - bubble_h - gap;
    let monitor = app
        .get_webview_window("main")
        .and_then(|pet| pet.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let area = monitor.work_area();
        let (ax, ay, aw, ah) = (
            area.position.x,
            area.position.y,
            area.size.width as i32,
            area.size.height as i32,
        );
        if y < ay {
            y = pet_y + pet_h + gap;
        }
        x = x.clamp(ax, (ax + aw - bubble_w).max(ax));
        y = y.clamp(ay, (ay + ah - bubble_h).max(ay));
    }
    Some((x, y))
}
