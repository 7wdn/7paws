use crate::{base_dimensions, AppState, BROWSER_ARGS};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

static WINDOW_CREATION: Mutex<()> = Mutex::new(());

#[tauri::command]
pub(crate) fn get_capture_aspects() -> [f64; 3] {
    ["65", "98", "104"].map(|layout| {
        let (width, height) = base_dimensions(layout);
        width / height
    })
}

fn open_window(app: &AppHandle) -> Result<(), String> {
    // Serialize requests from the settings window and tray.
    let _creation = WINDOW_CREATION.lock().map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window("capture") {
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let settings = app.state::<AppState>().settings.lock().unwrap().clone();
    let (width, height) = base_dimensions(&settings.keyboard_layout);
    WebviewWindowBuilder::new(app, "capture", WebviewUrl::App("capture.html".into()))
        .title("7paws 直播窗口")
        .inner_size(width, height)
        .min_inner_size(330.0, 240.0)
        .center()
        .decorations(true)
        .resizable(true)
        .transparent(false)
        .always_on_top(false)
        .skip_taskbar(false)
        .focused(false)
        .additional_browser_args(BROWSER_ARGS)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn show_capture_window(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(error) = open_window(&app) {
            eprintln!("failed to open capture window: {error}");
        }
    });
}

#[tauri::command]
pub(crate) async fn open_capture_window(app: AppHandle) -> Result<(), String> {
    // WebView2 initialization must run outside the UI thread.
    tauri::async_runtime::spawn_blocking(move || open_window(&app))
        .await
        .map_err(|e| e.to_string())?
}
