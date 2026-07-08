pub mod acp;
pub mod adapters;
pub mod commands;
pub mod errors;
pub mod session;

use acp::AcpSessionManager;
use session::SessionManager;
use std::sync::Arc;

#[tauri::command]
fn app_status() -> &'static str {
    "pty-core"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SessionManager::default())
        .manage(Arc::new(AcpSessionManager::default()))
        .invoke_handler(tauri::generate_handler![
            app_status,
            commands::start_fake_session,
            commands::start_codex_session,
            commands::write_session_input,
            commands::resize_session,
            commands::stop_session,
            commands::drain_session_output,
            commands::list_sessions,
            commands::list_agent_doctor_reports,
            commands::start_fake_acp_session,
            commands::start_acp_registry_session,
            commands::send_acp_prompt,
            commands::drain_acp_events,
            commands::stop_acp_session,
            commands::list_acp_sessions,
            commands::list_acp_registry_candidates,
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
