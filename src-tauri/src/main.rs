#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

const KEYCHAIN_SERVICE: &str = "AegisVault";
const KEYCHAIN_SECRET_KEY_ACCOUNT: &str = "vault-secret-key";

fn secret_key_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_SECRET_KEY_ACCOUNT)
        .map_err(|error| format!("Keychain entry could not be created: {error}"))
}

#[tauri::command]
fn store_secret_key(secret_key: String) -> Result<(), String> {
    if secret_key.trim().is_empty() {
        return Err("Secret key cannot be empty.".to_string());
    }

    secret_key_entry()?
        .set_password(secret_key.trim())
        .map_err(|error| format!("Secret key could not be stored in the OS keychain: {error}"))
}

#[tauri::command]
fn get_secret_key() -> Result<Option<String>, String> {
    match secret_key_entry()?.get_password() {
        Ok(secret_key) => Ok(Some(secret_key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Secret key could not be read from the OS keychain: {error}")),
    }
}

#[tauri::command]
fn delete_secret_key() -> Result<(), String> {
    match secret_key_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Secret key could not be removed from the OS keychain: {error}")),
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
        OpenClipboard(None)
            .map_err(|error| format!("Clipboard could not be opened: {error}"))?;
        let result = (|| {
            EmptyClipboard().map_err(|error| format!("Clipboard could not be emptied: {error}"))?;

            let wide = wide_null(value);
            let text_bytes = std::slice::from_raw_parts(
                wide.as_ptr().cast::<u8>(),
                wide.len() * std::mem::size_of::<u16>(),
            );
            set_clipboard_global_data(CF_UNICODETEXT_FORMAT, text_bytes)?;

            let block_history = 0u32.to_le_bytes();
            let history_format = RegisterClipboardFormatW(PCWSTR(wide_null("CanIncludeInClipboardHistory").as_ptr()));
            let cloud_format = RegisterClipboardFormatW(PCWSTR(wide_null("CanUploadToCloudClipboard").as_ptr()));
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_biometry::init())
        .invoke_handler(tauri::generate_handler![
            store_secret_key,
            get_secret_key,
            delete_secret_key,
            write_sensitive_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AegisVault desktop shell");
}
