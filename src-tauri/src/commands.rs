use crate::{
    domain::{AgentId, AgentInfo, Message, NewProject, Project},
    errors::AppResult,
    state::AppState,
};
use std::{path::PathBuf, str::FromStr};
use tauri::State;

#[tauri::command]
pub fn list_agents(state: State<'_, AppState>) -> Vec<AgentInfo> {
    state.adapters.list()
}

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> AppResult<Vec<Project>> {
    state.storage.list_projects()
}

#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    path: PathBuf,
    name: String,
    default_agent: Option<String>,
) -> AppResult<Project> {
    let default_agent = default_agent
        .as_deref()
        .map(AgentId::from_str)
        .transpose()?;

    state.storage.create_project(NewProject {
        name,
        path,
        default_agent,
    })
}

#[tauri::command]
pub fn get_transcript(state: State<'_, AppState>, session_id: String) -> AppResult<Vec<Message>> {
    state.storage.list_messages(&session_id)
}

#[tauri::command]
pub fn set_secret(state: State<'_, AppState>, agent_id: String, key: String) -> AppResult<()> {
    state
        .secrets
        .set_secret(AgentId::from_str(&agent_id)?, &key)
}

#[tauri::command]
pub fn has_secret(state: State<'_, AppState>, agent_id: String) -> AppResult<bool> {
    state.secrets.has_secret(AgentId::from_str(&agent_id)?)
}
