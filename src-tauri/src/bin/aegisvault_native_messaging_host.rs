use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fs;
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const PROTOCOL: &str = "aegisvault.desktopAutofill.v1";
const PENDING_AUTOFILL_REQUEST_FILE: &str = "pending_autofill_request.json";
const APPROVED_AUTOFILL_PAYLOAD_FILE: &str = "approved_autofill_payload.json";
const PENDING_AUTOFILL_SAVE_REQUEST_FILE: &str = "pending_autofill_save_request.json";
const MAX_MESSAGE_BYTES: usize = 32 * 1024;
const MAX_PASSWORD_LENGTH: usize = 4096;
const FILL_APPROVAL_TIMEOUT: Duration = Duration::from_secs(120);
const POLL_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeMessage {
    protocol: String,
    id: Option<String>,
    #[serde(rename = "type")]
    message_type: String,
    origin: Option<String>,
    url: Option<String>,
    username: Option<String>,
    password: Option<String>,
    form_signature: Option<String>,
    fields: Option<NativeFields>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeFields {
    has_username_field: Option<bool>,
    has_password_field: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeResponse {
    ok: bool,
    status: String,
    id: Option<String>,
    credential: Option<CredentialResponse>,
}

#[derive(Debug, Serialize)]
struct CredentialResponse {
    username: String,
    password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApprovedPayload {
    platform: String,
    origin: Option<String>,
    web_domain: Option<String>,
    username: String,
    password: String,
    expires_at: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApprovedPayloadEnvelope {
    version: u8,
    algorithm: String,
    iv: String,
    ciphertext: String,
    expires_at: u64,
}

fn main() {
    let response = match read_native_message().and_then(handle_message) {
        Ok(response) => response,
        Err(status) => NativeResponse {
            ok: false,
            status,
            id: None,
            credential: None,
        },
    };

    let _ = write_native_response(&response);
}

fn read_native_message() -> Result<NativeMessage, String> {
    let mut length_bytes = [0u8; 4];
    io::stdin()
        .read_exact(&mut length_bytes)
        .map_err(|_| "invalid-native-message-length".to_string())?;
    let length = u32::from_le_bytes(length_bytes) as usize;
    if length == 0 || length > MAX_MESSAGE_BYTES {
        return Err("native-message-too-large".to_string());
    }

    let mut buffer = vec![0u8; length];
    io::stdin()
        .read_exact(&mut buffer)
        .map_err(|_| "invalid-native-message-body".to_string())?;
    serde_json::from_slice(&buffer).map_err(|_| "malformed-native-message".to_string())
}

fn write_native_response(response: &NativeResponse) -> Result<(), String> {
    let body = serde_json::to_vec(response).map_err(|_| "response-serialization-failed".to_string())?;
    let length = (body.len() as u32).to_le_bytes();
    let mut stdout = io::stdout();
    stdout
        .write_all(&length)
        .and_then(|_| stdout.write_all(&body))
        .and_then(|_| stdout.flush())
        .map_err(|_| "response-write-failed".to_string())
}

fn handle_message(message: NativeMessage) -> Result<NativeResponse, String> {
    if message.protocol != PROTOCOL {
        return Err("unsupported-protocol".to_string());
    }

    match message.message_type.as_str() {
        "fill" => handle_fill(message),
        "save" => handle_save(message),
        _ => Err("unsupported-message-type".to_string()),
    }
}

fn handle_fill(message: NativeMessage) -> Result<NativeResponse, String> {
    let origin = sanitize_origin(message.origin.as_deref()).ok_or_else(|| "unsupported-origin".to_string())?;
    let domain = domain_from_origin(&origin).ok_or_else(|| "unsupported-origin".to_string())?;
    let fields = message.fields.as_ref();
    let has_username_field = fields.and_then(|value| value.has_username_field).unwrap_or(false);
    let has_password_field = fields.and_then(|value| value.has_password_field).unwrap_or(false);
    if !has_username_field && !has_password_field {
        return Err("unsupported-form".to_string());
    }

    let app_dir = app_data_dir()?;
    fs::create_dir_all(&app_dir).map_err(|_| "app-data-unavailable".to_string())?;
    clear_file(&app_dir.join(APPROVED_AUTOFILL_PAYLOAD_FILE));
    let handoff_key_b64 = create_handoff_key_b64();

    let pending = serde_json::json!({
        "platform": "desktop",
        "origin": origin,
        "webDomain": domain,
        "url": sanitize_url(message.url.as_deref()).unwrap_or(origin.clone()),
        "packageName": null,
        "hasUsernameField": has_username_field,
        "hasPasswordField": has_password_field,
        "formHints": ["username", "password"],
        "formSignature": safe_string(message.form_signature.as_deref(), 256),
        "handoffKeyB64": handoff_key_b64,
        "receivedAt": now_millis()
    });
    write_json_file(&app_dir.join(PENDING_AUTOFILL_REQUEST_FILE), &pending)?;
    launch_aegisvault();

    let approved = wait_for_approved_payload(&app_dir, &origin, &domain, &handoff_key_b64)?;
    Ok(NativeResponse {
        ok: true,
        status: "approved".to_string(),
        id: message.id,
        credential: Some(CredentialResponse {
            username: approved.username,
            password: approved.password,
        }),
    })
}

fn handle_save(message: NativeMessage) -> Result<NativeResponse, String> {
    let origin = sanitize_origin(message.origin.as_deref()).ok_or_else(|| "unsupported-origin".to_string())?;
    let domain = domain_from_origin(&origin).ok_or_else(|| "unsupported-origin".to_string())?;
    let password = message.password.unwrap_or_default();
    if password.is_empty() || password.len() > MAX_PASSWORD_LENGTH {
        return Err("invalid-save-payload".to_string());
    }

    let app_dir = app_data_dir()?;
    fs::create_dir_all(&app_dir).map_err(|_| "app-data-unavailable".to_string())?;

    let pending = serde_json::json!({
        "platform": "desktop",
        "origin": origin,
        "webDomain": domain,
        "url": sanitize_url(message.url.as_deref()).unwrap_or(origin.clone()),
        "packageName": null,
        "username": safe_string(message.username.as_deref(), 512),
        "password": password,
        "formHints": ["username", "password"],
        "formSignature": safe_string(message.form_signature.as_deref(), 256),
        "expiresAt": now_millis() + 300_000
    });
    write_json_file(&app_dir.join(PENDING_AUTOFILL_SAVE_REQUEST_FILE), &pending)?;
    launch_aegisvault();

    Ok(NativeResponse {
        ok: true,
        status: "staged".to_string(),
        id: message.id,
        credential: None,
    })
}

fn wait_for_approved_payload(
    app_dir: &PathBuf,
    origin: &str,
    domain: &str,
    handoff_key_b64: &str,
) -> Result<ApprovedPayload, String> {
    let approved_path = app_dir.join(APPROVED_AUTOFILL_PAYLOAD_FILE);
    let deadline = SystemTime::now()
        .checked_add(FILL_APPROVAL_TIMEOUT)
        .unwrap_or(SystemTime::now());

    while SystemTime::now() < deadline {
        if approved_path.exists() {
            let content = fs::read_to_string(&approved_path).map_err(|_| "approved-payload-unreadable".to_string())?;
            clear_file(&approved_path);
            let payload = parse_approved_payload(&content, handoff_key_b64)?;
            if payload.platform != "desktop" {
                return Err("approved-payload-platform-mismatch".to_string());
            }
            if payload.expires_at <= now_millis() {
                return Err("approved-payload-expired".to_string());
            }
            let payload_origin = payload.origin.as_deref().unwrap_or_default();
            let payload_domain = payload.web_domain.as_deref().unwrap_or_default();
            if payload_origin != origin && payload_domain != domain {
                return Err("approved-payload-target-mismatch".to_string());
            }
            if payload.password.is_empty() {
                return Err("approved-payload-empty".to_string());
            }
            return Ok(payload);
        }
        thread::sleep(POLL_INTERVAL);
    }

    Err("approval-timeout".to_string())
}

fn parse_approved_payload(content: &str, handoff_key_b64: &str) -> Result<ApprovedPayload, String> {
    let value: Value = serde_json::from_str(content).map_err(|_| "approved-payload-malformed".to_string())?;
    if value.get("version").and_then(Value::as_u64) != Some(2) {
        return serde_json::from_value(value).map_err(|_| "approved-payload-malformed".to_string());
    }

    let envelope: ApprovedPayloadEnvelope =
        serde_json::from_value(value).map_err(|_| "approved-payload-malformed".to_string())?;
    if envelope.version != 2 || envelope.algorithm != "AES-256-GCM" || envelope.expires_at <= now_millis() {
        return Err("approved-payload-envelope-invalid".to_string());
    }

    let key = BASE64.decode(handoff_key_b64).map_err(|_| "approved-payload-key-invalid".to_string())?;
    if key.len() != 32 {
        return Err("approved-payload-key-invalid".to_string());
    }
    let iv = BASE64.decode(envelope.iv).map_err(|_| "approved-payload-envelope-invalid".to_string())?;
    if iv.len() != 12 {
        return Err("approved-payload-envelope-invalid".to_string());
    }
    let ciphertext = BASE64
        .decode(envelope.ciphertext)
        .map_err(|_| "approved-payload-envelope-invalid".to_string())?;

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "approved-payload-key-invalid".to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
        .map_err(|_| "approved-payload-decryption-failed".to_string())?;
    serde_json::from_slice(&plaintext).map_err(|_| "approved-payload-malformed".to_string())
}

fn create_handoff_key_b64() -> String {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    BASE64.encode(key)
}

fn write_json_file(path: &PathBuf, value: &Value) -> Result<(), String> {
    let payload = serde_json::to_string(value).map_err(|_| "payload-serialization-failed".to_string())?;
    fs::write(path, payload).map_err(|_| "payload-write-failed".to_string())
}

fn clear_file(path: &PathBuf) {
    let _ = fs::remove_file(path);
}

fn sanitize_origin(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    let is_localhost = value.starts_with("http://localhost") || value.starts_with("http://127.0.0.1");
    if !value.starts_with("https://") && !is_localhost {
        return None;
    }
    let without_scheme = value
        .strip_prefix("https://")
        .or_else(|| value.strip_prefix("http://"))?;
    let host = without_scheme.split('/').next()?.split('?').next()?.split('#').next()?;
    if host.is_empty() || host.contains('@') || host.contains(' ') {
        return None;
    }
    let scheme = if value.starts_with("https://") { "https" } else { "http" };
    Some(format!("{scheme}://{host}").to_lowercase())
}

fn sanitize_url(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.len() > 2048 {
        return None;
    }
    let origin = sanitize_origin(Some(value))?;
    if value.starts_with(&origin) {
        Some(value.to_string())
    } else {
        Some(origin)
    }
}

fn domain_from_origin(origin: &str) -> Option<String> {
    origin
        .strip_prefix("https://")
        .or_else(|| origin.strip_prefix("http://"))
        .and_then(|value| value.split('/').next())
        .map(|value| value.trim_start_matches("www.").to_string())
        .filter(|value| !value.is_empty())
}

fn safe_string(value: Option<&str>, max_len: usize) -> String {
    value.unwrap_or_default().chars().take(max_len).collect()
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn app_data_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let base = env::var_os("APPDATA").ok_or_else(|| "app-data-unavailable".to_string())?;
        return Ok(PathBuf::from(base).join("com.aegisvault.desktop"));
    }

    #[cfg(target_os = "macos")]
    {
        let home = env::var_os("HOME").ok_or_else(|| "app-data-unavailable".to_string())?;
        return Ok(PathBuf::from(home).join("Library").join("Application Support").join("com.aegisvault.desktop"));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(base) = env::var_os("XDG_DATA_HOME") {
            return Ok(PathBuf::from(base).join("com.aegisvault.desktop"));
        }
        let home = env::var_os("HOME").ok_or_else(|| "app-data-unavailable".to_string())?;
        return Ok(PathBuf::from(home).join(".local").join("share").join("com.aegisvault.desktop"));
    }

    #[allow(unreachable_code)]
    Err("app-data-unavailable".to_string())
}

fn launch_aegisvault() {
    if let Some(path) = candidate_app_path() {
        let _ = Command::new(path).spawn();
    }
}

fn candidate_app_path() -> Option<PathBuf> {
    let exe = env::current_exe().ok()?;
    let dir = exe.parent()?;

    #[cfg(target_os = "windows")]
    {
        if let Some(path) = candidate_from_env("AEGISVAULT_DESKTOP_APP_PATH") {
            return Some(path);
        }
        if let Some(path) = candidate_from_host_config(dir) {
            return Some(path);
        }

        let mut candidates = vec![
            dir.join("AegisVault.exe"),
            dir.join("aegisvault.exe"),
        ];

        for env_name in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(base) = env::var_os(env_name) {
                let base = PathBuf::from(base);
                candidates.push(base.join("AegisVault").join("AegisVault.exe"));
                candidates.push(base.join("Programs").join("AegisVault").join("AegisVault.exe"));
            }
        }

        if let Some(app_data) = env::var_os("APPDATA") {
            candidates.push(PathBuf::from(app_data).join("AegisVault").join("AegisVault.exe"));
        }

        for path in candidates {
            if path.exists() {
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let path = dir.join("AegisVault.app").join("Contents").join("MacOS").join("AegisVault");
        if path.exists() {
            return Some(path);
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        for candidate in ["aegisvault", "AegisVault"] {
            let path = dir.join(candidate);
            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}

fn candidate_from_env(name: &str) -> Option<PathBuf> {
    let value = env::var_os(name)?;
    let path = PathBuf::from(value);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn candidate_from_host_config(host_dir: &std::path::Path) -> Option<PathBuf> {
    let content = fs::read_to_string(host_dir.join("aegisvault-app-path.txt")).ok()?;
    let path = PathBuf::from(content.trim());
    if path.exists() {
        Some(path)
    } else {
        None
    }
}
