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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            store_secret_key,
            get_secret_key,
            delete_secret_key,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AegisVault desktop shell");
}
