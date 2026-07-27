pub mod acp;
mod acp_workspace;
pub mod adapters;
pub mod commands;
pub mod delivery;
pub mod errors;
pub mod knowledge;
pub mod models;
pub mod session;
pub mod storage;
pub mod synthesis;
pub mod task;

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SessionManager::default())
        .manage(Arc::new(AcpSessionManager::default()))
        .manage(
            ProjectStore::open(default_database_path().expect("aiadne database path resolves"))
                .expect("aiadne project store opens"),
        )
        .invoke_handler(tauri::generate_handler![
            app_status,
            commands::list_model_catalog,
            commands::create_project,
            commands::list_projects,
            commands::delete_project,
            commands::create_project_repository,
            commands::list_project_repositories,
            commands::delete_project_repository,
            commands::inspect_git_delivery_readiness,
            commands::list_git_delivery_provenance_history,
            commands::create_project_initialization,
            commands::list_project_initializations,
            commands::collect_project_initialization_facts,
            commands::list_project_initialization_facts,
            commands::analyze_project_initialization_markdown,
            commands::list_project_initialization_markdown_findings,
            commands::save_project_initialization_guardrails,
            commands::list_project_initialization_guardrails,
            commands::generate_project_initialization_summary,
            commands::list_project_initialization_summary,
            commands::list_project_initialization_knowledge_units,
            commands::select_project_task_context,
            commands::select_unified_project_task_context,
            commands::approve_project_initialization_summary,
            commands::review_project_initialization_summary_claim,
            commands::create_transcript_session,
            commands::create_acp_transcript_session,
            commands::get_transcript_acp_identity,
            commands::create_task,
            commands::list_project_tasks,
            commands::update_task_complexity,
            commands::create_task_phase_artifact,
            commands::list_task_phase_artifacts,
            commands::create_task_agent_report,
            commands::run_task_agent_report,
            commands::list_task_agent_reports,
            commands::list_task_phase_run_receipts,
            commands::link_task_phase_run_events,
            commands::latest_task_phase_run_response_events,
            commands::list_task_context_dispatch_receipts,
            commands::resolve_pending_task_context_dispatch,
            commands::resolve_pending_task_phase_run,
            commands::transition_task_phase,
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
            commands::start_acp_registry_session,
            commands::load_acp_registry_session,
            commands::send_acp_prompt,
            commands::send_acp_prompt_with_context,
            commands::send_task_phase_prompt,
            commands::set_acp_model,
            commands::drain_acp_events,
            commands::list_acp_permissions,
            commands::respond_acp_permission,
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
