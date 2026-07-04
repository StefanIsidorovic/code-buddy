pub mod adapters;
pub mod agents_file;
pub mod commands;
pub mod domain;
pub mod errors;
pub mod secrets;
pub mod state;
pub mod storage;

use tauri::Manager;

pub use errors::{AppError, AppResult};

#[tauri::command]
fn app_status() -> &'static str {
    "ready"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("code-buddy.sqlite3");
            let storage = storage::ConfigStore::open(db_path)?;
            app.manage(state::AppState::new(storage));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_status,
            commands::list_agents,
            commands::list_projects,
            commands::create_project,
            commands::get_transcript,
            commands::set_secret,
            commands::has_secret,
            commands::resolve_agents_md,
            commands::create_agents_md,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::app_status;

    #[test]
    fn app_status_reports_ready() {
        assert_eq!(app_status(), "ready");
    }
}
