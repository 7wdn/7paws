use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

pub const MIN_SCALE: f64 = 0.1;
pub const MAX_SCALE: f64 = 1.5;

const COATS: [&str; 6] = ["tuxedo", "orange", "tabby", "calico", "white", "blue"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub scale: f64,
    pub always_on_top: bool,
    pub click_through_locked: bool,
    pub purr_pet: bool,
    pub purr_sleep: bool,
    pub autostart: bool,
    pub privacy_mode: bool,
    pub left_mouse: bool,
    pub coat: String,
    pub sleep_minutes: u32,
    pub show_key_labels: bool,
    pub keyboard_layout: String,
    pub show_tray_icon: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            x: None,
            y: None,
            scale: 0.6,
            always_on_top: true,
            click_through_locked: false,
            purr_pet: true,
            purr_sleep: false,
            autostart: false,
            privacy_mode: false,
            left_mouse: false,
            coat: "tuxedo".to_string(),
            sleep_minutes: 5,
            show_key_labels: true,
            keyboard_layout: "65".to_string(),
            show_tray_icon: true,
        }
    }
}

impl AppSettings {
    pub fn normalize(&mut self) {
        self.scale = self.scale.clamp(MIN_SCALE, MAX_SCALE);
        self.sleep_minutes = self.sleep_minutes.min(120);
        if !COATS.contains(&self.coat.as_str()) {
            self.coat = "tuxedo".to_string();
        }
        if self.keyboard_layout != "104" {
            self.keyboard_layout = "65".to_string();
        }
    }
}

fn data_dir(name: &str) -> PathBuf {
    #[cfg(windows)]
    {
        let base = std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));
        base.join(name)
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));
        home.join("Library").join("Application Support").join(name)
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        let home = std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));
        home.join(".config").join(name)
    }
}

pub fn app_data_dir() -> PathBuf {
    data_dir("7paws")
}

pub fn config_path() -> PathBuf {
    app_data_dir().join("settings.json")
}

fn legacy_config_path() -> PathBuf {
    data_dir("cat-pet").join("settings.json")
}

pub fn load_settings() -> AppSettings {
    let path = config_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(mut parsed) = serde_json::from_str::<AppSettings>(&content) {
            parsed.normalize();
            return parsed;
        }
    }
    // Migrate settings written before the 7paws rename.
    if let Ok(content) = fs::read_to_string(legacy_config_path()) {
        if let Ok(mut parsed) = serde_json::from_str::<AppSettings>(&content) {
            parsed.normalize();
            save_settings(&parsed);
            return parsed;
        }
    }
    AppSettings::default()
}

pub fn save_settings(settings: &AppSettings) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = fs::write(path, json);
    }
}

#[cfg(windows)]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER,
        KEY_SET_VALUE, REG_SZ,
    };

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    let subkey = to_wide("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
    let value_name = to_wide("7paws");
    let legacy_value_name = to_wide("CatPet");

    unsafe {
        let mut hkey: HKEY = std::ptr::null_mut();
        let status = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            0,
            KEY_SET_VALUE,
            &mut hkey,
        );
        if status != 0 {
            return Err(format!("RegOpenKeyExW failed with code {}", status));
        }

        let result = if enabled {
            let exe = std::env::current_exe()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();
            let data = to_wide(&format!("\"{}\"", exe));
            let byte_len = (data.len() * std::mem::size_of::<u16>()) as u32;
            let st = RegSetValueExW(
                hkey,
                value_name.as_ptr(),
                0,
                REG_SZ,
                data.as_ptr() as *const u8,
                byte_len,
            );
            if st == 0 {
                let _ = RegDeleteValueW(hkey, legacy_value_name.as_ptr());
                Ok(())
            } else {
                Err(format!("RegSetValueExW failed with code {}", st))
            }
        } else {
            let _ = RegDeleteValueW(hkey, value_name.as_ptr());
            let _ = RegDeleteValueW(hkey, legacy_value_name.as_ptr());
            Ok(())
        };

        RegCloseKey(hkey);
        result
    }
}

#[cfg(target_os = "macos")]
const LAUNCH_AGENT_LABEL: &str = "com.qoder.7paws";

#[cfg(target_os = "macos")]
fn launch_agent_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("LaunchAgents")
        .join(format!("{LAUNCH_AGENT_LABEL}.plist")))
}

#[cfg(target_os = "macos")]
fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(target_os = "macos")]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    let path = launch_agent_path()?;
    if !enabled {
        return match fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        };
    }

    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let bundle = exe
        .ancestors()
        .find(|p| p.extension().and_then(|e| e.to_str()) == Some("app"));

    let mut arguments = String::new();
    if let Some(bundle) = bundle {
        // Launch through LaunchServices so the bundled app starts as a whole.
        arguments.push_str("    <string>/usr/bin/open</string>\n");
        arguments.push_str("    <string>-a</string>\n");
        arguments.push_str(&format!(
            "    <string>{}</string>\n",
            xml_escape(bundle.to_string_lossy().as_ref())
        ));
    } else {
        arguments.push_str(&format!(
            "    <string>{}</string>\n",
            xml_escape(exe.to_string_lossy().as_ref())
        ));
    }

    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
{arguments}  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
"#
    );
    fs::write(&path, plist).map_err(|e| e.to_string())
}

#[cfg(not(any(windows, target_os = "macos")))]
pub fn set_autostart(_enabled: bool) -> Result<(), String> {
    Ok(())
}
