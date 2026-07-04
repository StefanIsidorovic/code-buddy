use crate::{
    agents_file,
    domain::{
        AgentId, AgentInfo, AgentsFileResolution, Message, NewProject, Project, SessionConfig,
        StartSessionRequest,
    },
    errors::AppResult,
    events::TauriSessionEmitter,
    state::AppState,
};
use std::{path::PathBuf, str::FromStr, sync::Arc};
use tauri::{AppHandle, State};

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

#[tauri::command]
pub fn resolve_agents_md(project_root: PathBuf, cwd: PathBuf) -> AppResult<AgentsFileResolution> {
    agents_file::resolve_agents_file(&cwd, &project_root)
}

#[tauri::command]
pub fn create_agents_md(project_root: PathBuf) -> AppResult<AgentsFileResolution> {
    agents_file::create_agents_file(&project_root)?;
    agents_file::resolve_agents_file(&project_root, &project_root)
}

#[tauri::command]
pub fn start_session(
    app: AppHandle,
    state: State<'_, AppState>,
    request: StartSessionRequest,
) -> AppResult<String> {
    let adapter = state.adapters.get(request.agent_id)?;
    state.sessions.start_session(
        adapter,
        SessionConfig {
            project_id: request.project_id,
            cwd: request.cwd,
            binary_path: request.binary_path,
            model: request.model,
            prompt: request.prompt,
            extra_args: request.extra_args,
            extra_env: request.extra_env,
        },
        request.mode,
        Arc::new(TauriSessionEmitter::new(app)),
    )
}

#[tauri::command]
pub fn write_input(state: State<'_, AppState>, session_id: String, text: String) -> AppResult<()> {
    state.sessions.write_input(&session_id, &text)
}

#[tauri::command]
pub fn write_raw(state: State<'_, AppState>, session_id: String, bytes: Vec<u8>) -> AppResult<()> {
    state.sessions.write_raw(&session_id, &bytes)
}

#[tauri::command]
pub fn resize_session(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> AppResult<()> {
    state.sessions.resize(&session_id, cols, rows)
}

#[tauri::command]
pub fn stop_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    force: Option<bool>,
) -> AppResult<()> {
    state.sessions.stop(
        &session_id,
        force.unwrap_or(false),
        Arc::new(TauriSessionEmitter::new(app)),
    )
}
