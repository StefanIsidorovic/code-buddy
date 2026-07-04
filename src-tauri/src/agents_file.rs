use crate::{
    domain::{
        AgentsFileApplication, AgentsFileDelivery, AgentsFileEntry, AgentsFileResolution,
        AgentsFileStatus,
    },
    errors::{AppError, AppResult},
};
use std::{
    fs,
    path::{Path, PathBuf},
};

const AGENTS_FILE_NAME: &str = "AGENTS.md";
const INJECTION_TAG: &str = "agents-md-instructions";

pub fn resolve_agents_file(cwd: &Path, project_root: &Path) -> AppResult<AgentsFileResolution> {
    let root = canonical_dir(project_root, "project root")?;
    let mut current = canonical_dir(cwd, "session cwd")?;

    if !current.starts_with(&root) {
        return Err(AppError::InvalidInput(format!(
            "session cwd {} is outside project root {}",
            current.display(),
            root.display()
        )));
    }

    let mut files = Vec::new();
    let mut priority = 0;

    loop {
        let candidate = current.join(AGENTS_FILE_NAME);
        if candidate.is_file() {
            files.push(AgentsFileEntry {
                path: candidate.clone(),
                relative_dir: current
                    .strip_prefix(&root)
                    .unwrap_or_else(|_| Path::new(""))
                    .to_path_buf(),
                priority,
                content: fs::read_to_string(&candidate)?,
            });
            priority += 1;
        }

        if current == root {
            break;
        }

        if !current.pop() {
            break;
        }
    }

    let active_path = files.first().map(|entry| entry.path.clone());
    let combined_content = combine_agents_content(&files);
    let status = if files.is_empty() {
        AgentsFileStatus::NotFound
    } else {
        AgentsFileStatus::Active
    };

    Ok(AgentsFileResolution {
        status,
        active_path,
        files,
        combined_content,
    })
}

pub fn create_agents_file(project_root: &Path) -> AppResult<PathBuf> {
    let root = canonical_dir(project_root, "project root")?;
    let path = root.join(AGENTS_FILE_NAME);

    if path.exists() {
        return Ok(path);
    }

    fs::write(path.clone(), scaffold_template())?;
    Ok(path)
}

pub fn apply_agents_file_delivery(
    delivery: &AgentsFileDelivery,
    resolution: &AgentsFileResolution,
    prompt: &str,
    already_delivered: bool,
) -> AgentsFileApplication {
    let Some(content) = resolution.combined_content.as_deref() else {
        return AgentsFileApplication {
            prompt: prompt.to_string(),
            args: Vec::new(),
            injected: false,
            status: AgentsFileStatus::NotFound,
        };
    };

    if already_delivered || matches!(delivery, AgentsFileDelivery::Native) {
        return AgentsFileApplication {
            prompt: prompt.to_string(),
            args: Vec::new(),
            injected: false,
            status: resolution.status.clone(),
        };
    }

    match delivery {
        AgentsFileDelivery::Native => unreachable!("native delivery handled above"),
        AgentsFileDelivery::InstructionsFlag(flag) => AgentsFileApplication {
            prompt: prompt.to_string(),
            args: vec![flag.clone(), content.to_string()],
            injected: true,
            status: AgentsFileStatus::Injected,
        },
        AgentsFileDelivery::PrependToPrompt => AgentsFileApplication {
            prompt: format!(
                "<{INJECTION_TAG}>\n# Project instructions from AGENTS.md\n{content}\n</{INJECTION_TAG}>\n\n{prompt}"
            ),
            args: Vec::new(),
            injected: true,
            status: AgentsFileStatus::Injected,
        },
    }
}

fn combine_agents_content(files: &[AgentsFileEntry]) -> Option<String> {
    if files.is_empty() {
        return None;
    }

    let mut sections = Vec::new();
    for entry in files.iter().rev() {
        let scope = if entry.relative_dir.as_os_str().is_empty() {
            ".".to_string()
        } else {
            entry.relative_dir.display().to_string()
        };
        sections.push(format!(
            "## AGENTS.md scope: {scope}\n{}",
            entry.content.trim()
        ));
    }

    Some(sections.join("\n\n"))
}

fn canonical_dir(path: &Path, label: &str) -> AppResult<PathBuf> {
    let canonical = path.canonicalize()?;
    if canonical.is_dir() {
        Ok(canonical)
    } else {
        Err(AppError::InvalidInput(format!(
            "{label} is not a directory: {}",
            path.display()
        )))
    }
}

fn scaffold_template() -> &'static str {
    "# AGENTS.md\n\n## Overview\n- Describe the project purpose and architecture.\n\n## Dev Environment\n- Document required tools and setup commands.\n\n## Build And Test Commands\n- Add the commands agents should run before committing.\n\n## Code Style\n- Document formatting, naming, and architectural conventions.\n\n## Testing\n- Document required unit, integration, and manual tests.\n\n## PR Guidelines\n- Document review expectations and commit conventions.\n\n## Security\n- Do not place secrets in this file.\n"
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn resolves_nearest_file_first_and_combines_parent_before_child() {
        let root = test_dir("nearest");
        let child = root.join("crates/app");
        fs::create_dir_all(&child).expect("mkdir");
        fs::write(root.join(AGENTS_FILE_NAME), "root rules").expect("root agents");
        fs::write(child.join(AGENTS_FILE_NAME), "child rules").expect("child agents");

        let resolution = resolve_agents_file(&child, &root).expect("resolution");

        assert_eq!(resolution.status, AgentsFileStatus::Active);
        assert_eq!(resolution.files.len(), 2);
        assert_eq!(
            resolution.files[0].relative_dir,
            PathBuf::from("crates/app")
        );
        assert_eq!(resolution.files[1].relative_dir, PathBuf::from(""));
        assert_eq!(resolution.active_path, Some(child.join(AGENTS_FILE_NAME)));
        assert!(resolution
            .combined_content
            .expect("combined")
            .contains("root rules\n\n## AGENTS.md scope: crates/app\nchild rules"));
        cleanup(&root);
    }

    #[test]
    fn reports_not_found_without_content() {
        let root = test_dir("missing");
        let resolution = resolve_agents_file(&root, &root).expect("resolution");

        assert_eq!(resolution.status, AgentsFileStatus::NotFound);
        assert!(resolution.active_path.is_none());
        assert!(resolution.files.is_empty());
        assert!(resolution.combined_content.is_none());
        cleanup(&root);
    }

    #[test]
    fn rejects_cwd_outside_project_root() {
        let root = test_dir("root");
        let outside = test_dir("outside");

        let err = resolve_agents_file(&outside, &root).expect_err("outside rejected");

        assert!(matches!(err, AppError::InvalidInput(_)));
        cleanup(&root);
        cleanup(&outside);
    }

    #[test]
    fn native_delivery_does_not_inject() {
        let root = test_dir("native");
        fs::write(root.join(AGENTS_FILE_NAME), "native rules").expect("agents");
        let resolution = resolve_agents_file(&root, &root).expect("resolution");

        let applied =
            apply_agents_file_delivery(&AgentsFileDelivery::Native, &resolution, "hello", false);

        assert_eq!(applied.prompt, "hello");
        assert!(applied.args.is_empty());
        assert!(!applied.injected);
        assert_eq!(applied.status, AgentsFileStatus::Active);
        cleanup(&root);
    }

    #[test]
    fn prepend_delivery_is_idempotent() {
        let root = test_dir("prepend");
        fs::write(root.join(AGENTS_FILE_NAME), "prepend rules").expect("agents");
        let resolution = resolve_agents_file(&root, &root).expect("resolution");

        let first = apply_agents_file_delivery(
            &AgentsFileDelivery::PrependToPrompt,
            &resolution,
            "hello",
            false,
        );
        let second = apply_agents_file_delivery(
            &AgentsFileDelivery::PrependToPrompt,
            &resolution,
            "hello",
            true,
        );

        assert!(first.injected);
        assert!(first.prompt.contains("prepend rules"));
        assert_eq!(first.status, AgentsFileStatus::Injected);
        assert!(!second.injected);
        assert_eq!(second.prompt, "hello");
        cleanup(&root);
    }

    #[test]
    fn flag_delivery_returns_flag_args() {
        let root = test_dir("flag");
        fs::write(root.join(AGENTS_FILE_NAME), "flag rules").expect("agents");
        let resolution = resolve_agents_file(&root, &root).expect("resolution");

        let applied = apply_agents_file_delivery(
            &AgentsFileDelivery::InstructionsFlag("--system".to_string()),
            &resolution,
            "hello",
            false,
        );

        assert_eq!(applied.prompt, "hello");
        assert_eq!(applied.args[0], "--system");
        assert!(applied.args[1].contains("flag rules"));
        assert!(applied.injected);
        cleanup(&root);
    }

    #[test]
    fn creates_template_once() {
        let root = test_dir("create");
        let path = create_agents_file(&root).expect("created");
        let first = fs::read_to_string(&path).expect("template");
        let second_path = create_agents_file(&root).expect("existing");
        let second = fs::read_to_string(&second_path).expect("template");

        assert_eq!(path, second_path);
        assert!(first.contains("## Build And Test Commands"));
        assert_eq!(first, second);
        cleanup(&root);
    }

    fn test_dir(name: &str) -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_millis();
        let dir = std::env::temp_dir().join(format!("code-buddy-agents-{name}-{millis}"));
        fs::create_dir_all(&dir).expect("test dir");
        dir
    }

    fn cleanup(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }
}
