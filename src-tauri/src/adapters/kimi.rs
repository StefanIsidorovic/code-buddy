use super::{
    base_command, detect_binary, resolve_program, structured, AgentAdapter, AgentOutputParser,
};
use crate::{
    domain::{
        AgentId, AgentsFileDelivery, Capabilities, CommandSpec, Detection, InputDelivery, RunMode,
        SessionConfig,
    },
    errors::AppResult,
};

pub struct KimiAdapter;

impl AgentAdapter for KimiAdapter {
    fn id(&self) -> AgentId {
        AgentId::Kimi
    }

    fn display_name(&self) -> &'static str {
        "Kimi"
    }

    fn detect(&self) -> Detection {
        detect_binary("kimi", &["--version"])
    }

    fn capabilities(&self) -> Capabilities {
        Capabilities {
            interactive: true,
            headless: true,
            structured_events: true,
            resume_session: true,
            selectable_model: true,
            streaming: true,
            reads_agents_md_natively: false,
        }
    }

    fn build_command(&self, cfg: &SessionConfig, mode: RunMode) -> AppResult<CommandSpec> {
        let program = resolve_program("kimi", cfg.binary_path.as_ref())?;
        let mut spec = base_command(program, cfg);

        spec.args.push("--work-dir".to_string());
        spec.args.push(cfg.cwd.display().to_string());

        if matches!(mode, RunMode::Headless) {
            spec.args.push("--print".to_string());
            spec.args.push("--output-format".to_string());
            spec.args.push("stream-json".to_string());
        }

        if let Some(model) = &cfg.model {
            spec.args.push("--model".to_string());
            spec.args.push(model.clone());
        }

        spec.args.extend(cfg.extra_args.clone());

        if matches!(mode, RunMode::Headless) {
            if let Some(prompt) = &cfg.prompt {
                spec.args.push("--prompt".to_string());
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
        AgentsFileDelivery::PrependToPrompt
    }

    fn create_parser(&self) -> Box<dyn AgentOutputParser> {
        structured::kimi_parser()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, path::PathBuf};

    #[test]
    fn headless_command_uses_print_stream_json_prompt_flag() {
        let cfg = SessionConfig {
            project_id: None,
            cwd: PathBuf::from("/tmp/project"),
            binary_path: Some(PathBuf::from("/usr/local/bin/kimi-test")),
            model: Some("kimi-k2".to_string()),
            prompt: Some("plan".to_string()),
            extra_args: vec!["--thinking".to_string()],
            extra_env: HashMap::new(),
        };

        let spec = KimiAdapter
            .build_command(&cfg, RunMode::Headless)
            .expect("command builds with binary override");

        assert!(spec.args.contains(&"--work-dir".to_string()));
        assert_eq!(spec.program, PathBuf::from("/usr/local/bin/kimi-test"));
        assert!(spec.args.contains(&"--work-dir".to_string()));
        assert!(spec.args.contains(&"--print".to_string()));
        assert!(spec.args.contains(&"stream-json".to_string()));
        assert!(spec.args.contains(&"--prompt".to_string()));
        assert_eq!(spec.args.last(), Some(&"plan".to_string()));
    }
}
