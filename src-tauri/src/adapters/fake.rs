use super::{base_command, AgentAdapter};
use crate::{
    domain::{
        AgentId, Capabilities, CommandSpec, Detection, InputDelivery, RunMode, SessionConfig,
    },
    errors::AppResult,
};
use std::path::PathBuf;

pub struct FakeAdapter;

impl AgentAdapter for FakeAdapter {
    fn id(&self) -> AgentId {
        AgentId::Fake
    }

    fn display_name(&self) -> &'static str {
        "Fake Agent"
    }

    fn detect(&self) -> Detection {
        Detection {
            installed: true,
            binary_path: Some(PathBuf::from("/bin/sh")),
            version: Some("fake".to_string()),
        }
    }

    fn capabilities(&self) -> Capabilities {
        Capabilities {
            interactive: true,
            headless: true,
            structured_events: false,
            resume_session: false,
            selectable_model: false,
            streaming: true,
            reads_agents_md_natively: false,
        }
    }

    fn build_command(&self, cfg: &SessionConfig, _mode: RunMode) -> AppResult<CommandSpec> {
        let mut spec = base_command(PathBuf::from("/bin/sh"), cfg);
        spec.args = vec!["-lc".to_string(), "cat".to_string()];
        Ok(spec)
    }

    fn encode_input(&self, text: &str, _mode: RunMode) -> InputDelivery {
        InputDelivery::PtyBytes(format!("{text}\n").into_bytes())
    }
}
