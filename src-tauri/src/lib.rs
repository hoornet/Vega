use keyring::Entry;

const KEYRING_SERVICE: &str = "wrystr";

/// Store an nsec in the OS keychain, keyed by pubkey (hex).
#[tauri::command]
fn store_nsec(pubkey: String, nsec: String) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, &pubkey).map_err(|e| e.to_string())?;
    entry.set_password(&nsec).map_err(|e| e.to_string())
}

/// Load a stored nsec from the OS keychain. Returns None if no entry exists.
#[tauri::command]
fn load_nsec(pubkey: String) -> Result<Option<String>, String> {
    let entry = Entry::new(KEYRING_SERVICE, &pubkey).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(nsec) => Ok(Some(nsec)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete a stored nsec from the OS keychain.
#[tauri::command]
fn delete_nsec(pubkey: String) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, &pubkey).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // already gone — that's fine
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![store_nsec, load_nsec, delete_nsec])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
