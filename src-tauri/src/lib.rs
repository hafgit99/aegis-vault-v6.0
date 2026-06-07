use std::fs;
use std::path::PathBuf;

use tauri::Manager;

const PENDING_AUTOFILL_REQUEST_FILE: &str = "pending_autofill_request.json";
const APPROVED_AUTOFILL_PAYLOAD_FILE: &str = "approved_autofill_payload.json";
const MAX_AUTOFILL_PAYLOAD_BYTES: usize = 16 * 1024;

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const KEYCHAIN_SERVICE: &str = "AegisVault";
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
const KEYCHAIN_SECRET_KEY_ACCOUNT: &str = "vault-secret-key";

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn secret_key_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_SECRET_KEY_ACCOUNT)
        .map_err(|error| format!("Keychain entry could not be created: {error}"))
}

#[tauri::command]
fn store_secret_key(secret_key: String) -> Result<(), String> {
    if secret_key.trim().is_empty() {
        return Err("Secret key cannot be empty.".to_string());
    }

    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        return secret_key_entry()?
            .set_password(secret_key.trim())
            .map_err(|error| {
                format!("Secret key could not be stored in the OS keychain: {error}")
            });
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Native secret key storage is not implemented for this platform yet.".to_string())
    }
}

#[tauri::command]
fn get_secret_key() -> Result<Option<String>, String> {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        return match secret_key_entry()?.get_password() {
            Ok(secret_key) => Ok(Some(secret_key)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(format!(
                "Secret key could not be read from the OS keychain: {error}"
            )),
        };
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn delete_secret_key() -> Result<(), String> {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        return match secret_key_entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "Secret key could not be removed from the OS keychain: {error}"
            )),
        };
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(())
    }
}

#[cfg(windows)]
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
unsafe fn set_clipboard_global_data(format: u32, bytes: &[u8]) -> Result<(), String> {
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::DataExchange::SetClipboardData;
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

    let handle = GlobalAlloc(GMEM_MOVEABLE, bytes.len())
        .map_err(|error| format!("Clipboard memory could not be allocated: {error}"))?;
    let ptr = GlobalLock(handle);
    if ptr.is_null() {
        return Err("Clipboard memory could not be locked.".to_string());
    }

    std::ptr::copy_nonoverlapping(bytes.as_ptr(), ptr.cast::<u8>(), bytes.len());
    let _ = GlobalUnlock(handle);

    SetClipboardData(format, Some(HANDLE(handle.0)))
        .map_err(|error| format!("Clipboard data could not be set: {error}"))?;
    Ok(())
}

#[cfg(windows)]
fn write_sensitive_clipboard_platform(value: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW,
    };

    const CF_UNICODETEXT_FORMAT: u32 = 13;

    unsafe {
        OpenClipboard(None).map_err(|error| format!("Clipboard could not be opened: {error}"))?;
        let result = (|| {
            EmptyClipboard().map_err(|error| format!("Clipboard could not be emptied: {error}"))?;

            let wide = wide_null(value);
            let text_bytes = std::slice::from_raw_parts(
                wide.as_ptr().cast::<u8>(),
                wide.len() * std::mem::size_of::<u16>(),
            );
            set_clipboard_global_data(CF_UNICODETEXT_FORMAT, text_bytes)?;

            let block_history = 0u32.to_le_bytes();
            let history_format = RegisterClipboardFormatW(PCWSTR(
                wide_null("CanIncludeInClipboardHistory").as_ptr(),
            ));
            let cloud_format =
                RegisterClipboardFormatW(PCWSTR(wide_null("CanUploadToCloudClipboard").as_ptr()));
            set_clipboard_global_data(history_format, &block_history)?;
            set_clipboard_global_data(cloud_format, &block_history)?;
            Ok(())
        })();
        let _ = CloseClipboard();
        result
    }
}

#[cfg(not(windows))]
fn write_sensitive_clipboard_platform(_value: &str) -> Result<(), String> {
    Err("Sensitive clipboard flags are only implemented for Windows desktop builds.".to_string())
}

#[tauri::command]
fn write_sensitive_clipboard(value: String) -> Result<(), String> {
    write_sensitive_clipboard_platform(&value)
}

fn validate_app_private_filename(filename: &str) -> Result<&str, String> {
    let trimmed = filename.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains("..")
        || !trimmed.ends_with(".sqlite")
    {
        return Err("Invalid app-private vault filename.".to_string());
    }
    Ok(trimmed)
}

fn app_private_file_path(app: &tauri::AppHandle, filename: &str) -> Result<PathBuf, String> {
    let safe_filename = validate_app_private_filename(filename)?;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("App-private storage directory could not be resolved: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("App-private storage directory could not be created: {error}"))?;
    Ok(dir.join(safe_filename))
}

fn pending_autofill_request_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("App-private storage directory could not be resolved: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("App-private storage directory could not be created: {error}"))?;
    Ok(dir.join(PENDING_AUTOFILL_REQUEST_FILE))
}

fn approved_autofill_payload_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("App-private storage directory could not be resolved: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("App-private storage directory could not be created: {error}"))?;
    Ok(dir.join(APPROVED_AUTOFILL_PAYLOAD_FILE))
}

#[tauri::command]
fn read_app_private_file(
    app: tauri::AppHandle,
    filename: String,
) -> Result<Option<Vec<u8>>, String> {
    let path = app_private_file_path(&app, &filename)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read(path)
        .map(Some)
        .map_err(|error| format!("App-private vault file could not be read: {error}"))
}

#[tauri::command]
fn write_app_private_file(
    app: tauri::AppHandle,
    filename: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let path = app_private_file_path(&app, &filename)?;
    fs::write(path, bytes)
        .map_err(|error| format!("App-private vault file could not be written: {error}"))
}

#[tauri::command]
fn delete_app_private_file(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let path = app_private_file_path(&app, &filename)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "App-private vault file could not be deleted: {error}"
        )),
    }
}

#[tauri::command]
fn clear_app_private_sqlite_files(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("App-private storage directory could not be resolved: {error}"))?;
    if !dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)
        .map_err(|error| format!("App-private storage directory could not be listed: {error}"))?
    {
        let entry = entry
            .map_err(|error| format!("App-private storage entry could not be read: {error}"))?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) == Some("sqlite") {
            fs::remove_file(path).map_err(|error| {
                format!("App-private SQLite file could not be deleted: {error}")
            })?;
        }
    }

    Ok(())
}

#[tauri::command]
fn read_pending_autofill_request(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = pending_autofill_request_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path)
        .map(Some)
        .map_err(|error| format!("Pending autofill request could not be read: {error}"))
}

#[tauri::command]
fn clear_pending_autofill_request(app: tauri::AppHandle) -> Result<(), String> {
    let path = pending_autofill_request_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Pending autofill request could not be cleared: {error}"
        )),
    }
}

#[tauri::command]
fn write_approved_autofill_payload(app: tauri::AppHandle, payload: String) -> Result<(), String> {
    let trimmed = payload.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_AUTOFILL_PAYLOAD_BYTES {
        return Err("Approved autofill payload size is invalid.".to_string());
    }

    let path = approved_autofill_payload_path(&app)?;
    fs::write(path, trimmed)
        .map_err(|error| format!("Approved autofill payload could not be written: {error}"))
}

#[tauri::command]
fn clear_approved_autofill_payload(app: tauri::AppHandle) -> Result<(), String> {
    let path = approved_autofill_payload_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Approved autofill payload could not be cleared: {error}"
        )),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_biometry::init())
        .invoke_handler(tauri::generate_handler![
            store_secret_key,
            get_secret_key,
            delete_secret_key,
            write_sensitive_clipboard,
            read_app_private_file,
            write_app_private_file,
            delete_app_private_file,
            clear_app_private_sqlite_files,
            read_pending_autofill_request,
            clear_pending_autofill_request,
            write_approved_autofill_payload,
            clear_approved_autofill_payload,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AegisVault shell");
}
