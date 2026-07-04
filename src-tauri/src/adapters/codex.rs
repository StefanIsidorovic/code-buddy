use super::{base_command, detect_binary, resolve_program, AgentAdapter};
use crate::{
    domain::{
        AgentId, AgentsFileDelivery, Capabilities, CommandSpec, Detection, InputDelivery, RunMode,
        SessionConfig,
    },
    errors::AppResult,
};

pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn id(&self) -> AgentId {
        AgentId::Codex
    }

    fn display_name(&self) -> &'static str {
        "Codex"
    }

    fn detect(&self) -> Detection {
        detect_binary("codex", &["--version"])
    }

    fn capabilities(&self) -> Capabilities {
        Capabilities {
            interactive: true,
            headless: true,
            structured_events: true,
            resume_session: true,
            selectable_model: true,
            streaming: true,
            reads_agents_md_natively: true,
        }
    }

    fn build_command(&self, cfg: &SessionConfig, mode: RunMode) -> AppResult<CommandSpec> {
        let program = resolve_program("codex", cfg.binary_path.as_ref())?;
        let mut spec = base_command(program, cfg);

        if matches!(mode, RunMode::Headless) {
            spec.args.push("exec".to_string());
            spec.args.push("--json".to_string());
        }

        spec.args.push("--cd".to_string());
        spec.args.push(cfg.cwd.display().to_string());

        if let Some(model) = &cfg.model {
            spec.args.push("--model".to_string());
            spec.args.push(model.clone());
        }

        spec.args.extend(cfg.extra_args.clone());

        if matches!(mode, RunMode::Headless) {
            if let Some(prompt) = &cfg.prompt {
                spec.args.push(prompt.clone());
            }
        }

        Ok(spec)
    }

    fn encode_input(&self, text: &str, mode: RunMode) -> InputDelivery {
        match mode {
            RunMode::Interactive => InputDelivery::PtyBytes(format!("{text}\n").into_bytes()),
            RunMode::Headless => InputDelivery::HeadlessPromptArg(text.to_string()),
        }
    }

    fn agents_file_delivery(&self) -> AgentsFileDelivery {
        AgentsFileDelivery::Native
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, path::PathBuf};

    fn cfg() -> SessionConfig {
        SessionConfig {
            project_id: None,
            cwd: PathBuf::from("/tmp/project"),
            binary_path: Some(PathBuf::from("/usr/local/bin/codex-test")),
            model: Some("gpt-5-codex".to_string()),
            prompt: Some("summarize".to_string()),
            extra_args: vec!["--sandbox".to_string(), "read-only".to_string()],
            extra_env: HashMap::from([("RUST_LOG".to_string(), "info".to_string())]),
        }
    }

    #[test]
    fn headless_command_uses_exec_json_and_prompt() {
        let spec = CodexAdapter
            .build_command(&cfg(), RunMode::Headless)
            .expect("command builds with binary override");

        assert_eq!(spec.program, PathBuf::from("/usr/local/bin/codex-test"));
        assert_eq!(spec.args[0], "exec");
        assert!(spec.args.contains(&"--json".to_string()));
        assert!(spec.args.contains(&"--cd".to_string()));
        assert!(spec.args.contains(&"gpt-5-codex".to_string()));
        assert_eq!(spec.args.last(), Some(&"summarize".to_string()));
        assert_eq!(spec.env.get("RUST_LOG"), Some(&"info".to_string()));
    }

    #[test]
    fn interactive_input_is_newline_terminated_pty_bytes() {
        assert_eq!(
            CodexAdapter.encode_input("hello", RunMode::Interactive),
            InputDelivery::PtyBytes(b"hello\n".to_vec())
        );
    }
}
