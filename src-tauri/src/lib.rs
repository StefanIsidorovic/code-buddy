pub mod acp;
pub mod adapters;
pub mod commands;
pub mod errors;
pub mod session;
pub mod storage;

use acp::AcpSessionManager;
use session::SessionManager;
use std::sync::Arc;
use storage::{default_database_path, ProjectStore};

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
        .manage(
            ProjectStore::open(default_database_path().expect("aiadne database path resolves"))
                .expect("aiadne project store opens"),
        )
        .invoke_handler(tauri::generate_handler![
            app_status,
            commands::create_project,
            commands::list_projects,
            commands::delete_project,
            commands::create_project_repository,
            commands::list_project_repositories,
            commands::delete_project_repository,
            commands::create_transcript_session,
            commands::append_transcript_events,
            commands::list_transcript_sessions,
            commands::list_transcript_events,
            commands::rename_transcript_session,
            commands::create_knowledge_item,
            commands::list_knowledge_items,
            commands::attach_knowledge_to_transcript_session,
            commands::list_attached_knowledge,
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
