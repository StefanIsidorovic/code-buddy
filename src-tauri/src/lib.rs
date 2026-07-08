pub mod adapters;
pub mod commands;
pub mod errors;
pub mod session;

use session::SessionManager;

#[tauri::command]
fn app_status() -> &'static str {
    "pty-core"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SessionManager::default())
        .invoke_handler(tauri::generate_handler![
            app_status,
            commands::start_fake_session,
            commands::start_codex_session,
            commands::write_session_input,
            commands::resize_session,
            commands::stop_session,
            commands::drain_session_output,
            commands::list_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::app_status;

    #[test]
    fn app_status_reports_pty_core() {
        assert_eq!(app_status(), "pty-core");
    }
}
