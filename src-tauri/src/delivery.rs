use crate::errors::{AppError, AppResult};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    process::Command,
};

const PROVENANCE_REF: &str = "refs/notes/provenance";
const MAX_CHANGED_FILES: usize = 20;
const MAX_NOTE_PREVIEW_LENGTH: usize = 240;
const MAX_PROVENANCE_HISTORY: usize = 8;
const MAX_RATIONALE_PREVIEW_LENGTH: usize = 180;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDeliveryChangedFileInfo {
    pub status: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDeliveryProvenanceInfo {
    pub present: bool,
    pub ref_name: String,
    pub plan_step_id: Option<String>,
    pub note_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDeliveryReadinessInfo {
    pub repository_path: String,
    pub branch: Option<String>,
    pub head_sha: Option<String>,
    pub head_subject: Option<String>,
    pub worktree_clean: bool,
    pub changed_file_count: usize,
    pub changed_files: Vec<GitDeliveryChangedFileInfo>,
    pub head_provenance: GitDeliveryProvenanceInfo,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDeliveryProvenanceHistoryEntry {
    pub commit_sha: String,
    pub short_sha: String,
    pub subject: String,
    pub has_provenance: bool,
    pub plan_step_id: Option<String>,
    pub severity: Option<u8>,
    pub rationale: Option<String>,
    pub note_preview: Option<String>,
}

pub fn inspect_git_delivery_readiness(
    repository_path: PathBuf,
) -> AppResult<GitDeliveryReadinessInfo> {
    let repository_path = normalize_repository_path(repository_path)?;
    ensure_git_repository(&repository_path)?;
    let branch = non_empty(git_output(&repository_path, &["branch", "--show-current"])?);
    let head_sha = non_empty(git_output(
        &repository_path,
        &["rev-parse", "--short=12", "HEAD"],
    )?);
    let head_subject = non_empty(git_output(&repository_path, &["log", "-1", "--pretty=%s"])?);
    let changed_files = parse_porcelain_status(&git_stdout(
        &repository_path,
        &["status", "--porcelain=v1", "--untracked-files=normal"],
    )?);
    let changed_file_count = changed_files.len();
    let head_provenance = inspect_head_provenance(&repository_path);

    Ok(GitDeliveryReadinessInfo {
        repository_path: repository_path.display().to_string(),
        branch,
        head_sha,
        head_subject,
        worktree_clean: changed_file_count == 0,
        changed_file_count,
        changed_files: changed_files.into_iter().take(MAX_CHANGED_FILES).collect(),
        head_provenance,
    })
}

pub fn list_git_delivery_provenance_history(
    repository_path: PathBuf,
    limit: usize,
) -> AppResult<Vec<GitDeliveryProvenanceHistoryEntry>> {
    let repository_path = normalize_repository_path(repository_path)?;
    ensure_git_repository(&repository_path)?;
    let capped_limit = limit.clamp(1, MAX_PROVENANCE_HISTORY);
    let max_count_arg = format!("--max-count={capped_limit}");
    let output = git_stdout(
        &repository_path,
        &[
            "log",
            max_count_arg.as_str(),
            "--pretty=format:%H%x1f%h%x1f%s",
        ],
    )?;
    Ok(output
        .lines()
        .filter_map(|line| parse_history_log_line(&repository_path, line))
        .collect())
}

fn normalize_repository_path(repository_path: PathBuf) -> AppResult<PathBuf> {
    if repository_path.as_os_str().is_empty() {
        return Err(AppError::InvalidInput(
            "delivery readiness requires a repository path".into(),
        ));
    }
    if !repository_path.exists() {
        return Err(AppError::InvalidInput(
            "delivery readiness repository path does not exist".into(),
        ));
    }
    if !repository_path.is_dir() {
        return Err(AppError::InvalidInput(
            "delivery readiness repository path must be a directory".into(),
        ));
    }
    Ok(repository_path)
}

fn ensure_git_repository(repository_path: &Path) -> AppResult<()> {
    let output = git_output(repository_path, &["rev-parse", "--is-inside-work-tree"])?;
    if output == "true" {
        Ok(())
    } else {
        Err(AppError::InvalidInput(
            "delivery readiness requires a Git worktree".into(),
        ))
    }
}

fn inspect_head_provenance(repository_path: &Path) -> GitDeliveryProvenanceInfo {
    let note = git_output_optional(
        repository_path,
        &["notes", "--ref", PROVENANCE_REF, "show", "HEAD"],
    );
    let plan_step_id = note.as_deref().and_then(extract_plan_step_id);
    GitDeliveryProvenanceInfo {
        present: note.is_some(),
        ref_name: PROVENANCE_REF.to_string(),
        plan_step_id,
        note_preview: note.map(trim_note_preview),
    }
}

fn parse_history_log_line(
    repository_path: &Path,
    line: &str,
) -> Option<GitDeliveryProvenanceHistoryEntry> {
    let mut parts = line.splitn(3, '\u{1f}');
    let commit_sha = non_empty(parts.next()?.to_string())?;
    let short_sha = non_empty(parts.next()?.to_string())?;
    let subject = parts.next().unwrap_or_default().to_string();
    let note = git_output_optional(
        repository_path,
        &[
            "notes",
            "--ref",
            PROVENANCE_REF,
            "show",
            commit_sha.as_str(),
        ],
    );
    let note_value = note
        .as_deref()
        .and_then(|raw_note| serde_json::from_str::<serde_json::Value>(raw_note).ok());
    let plan_step_id = note_value
        .as_ref()
        .and_then(|value| extract_json_string(value, "plan_step_id"));
    let severity = note_value
        .as_ref()
        .and_then(|value| value.get("severity"))
        .and_then(|severity| severity.as_u64())
        .and_then(|severity| u8::try_from(severity).ok());
    let rationale = note_value
        .as_ref()
        .and_then(|value| extract_json_string(value, "rationale"))
        .map(|value| trim_text_preview(value, MAX_RATIONALE_PREVIEW_LENGTH));
    Some(GitDeliveryProvenanceHistoryEntry {
        commit_sha,
        short_sha,
        subject,
        has_provenance: note.is_some(),
        plan_step_id,
        severity,
        rationale,
        note_preview: note.map(trim_note_preview),
    })
}

fn git_output(repository_path: &Path, args: &[&str]) -> AppResult<String> {
    Ok(git_stdout(repository_path, args)?.trim().to_string())
}

fn git_stdout(repository_path: &Path, args: &[&str]) -> AppResult<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repository_path)
        .args(args)
        .output()?;
    if !output.status.success() {
        return Err(AppError::InvalidInput(format!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        )));
    }
    Ok(String::from_utf8_lossy(&output.stdout)
        .trim_end_matches(['\r', '\n'])
        .to_string())
}

fn git_output_optional(repository_path: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repository_path)
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    non_empty(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn parse_porcelain_status(output: &str) -> Vec<GitDeliveryChangedFileInfo> {
    output
        .lines()
        .filter_map(|line| {
            if line.len() < 4 {
                return None;
            }
            Some(GitDeliveryChangedFileInfo {
                status: line[..2].trim().to_string(),
                path: line[3..].to_string(),
            })
        })
        .collect()
}

fn extract_plan_step_id(note: &str) -> Option<String> {
    let value = serde_json::from_str::<serde_json::Value>(note).ok()?;
    extract_json_string(&value, "plan_step_id")
}

fn extract_json_string(value: &serde_json::Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(ToOwned::to_owned)
}

fn trim_note_preview(note: String) -> String {
    trim_text_preview(note, MAX_NOTE_PREVIEW_LENGTH)
}

fn trim_text_preview(text: String, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text;
    }
    let clipped = text
        .chars()
        .take(max_chars.saturating_sub(1))
        .collect::<String>();
    format!("{}…", clipped.trim_end())
}

fn non_empty(value: String) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    fn temp_delivery_repo(label: &str) -> PathBuf {
        let path = std::env::temp_dir()
            .join("aiadne-delivery-tests")
            .join(format!("{label}-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("temp delivery repo");
        path
    }

    fn initialize_repo(path: &Path) {
        run_git(path, &["init"]);
        fs::write(path.join("README.md"), "# Delivery\n").expect("readme written");
        run_git(path, &["add", "."]);
        commit_all(path, "initial delivery");
    }

    fn commit_all(path: &Path, message: &str) {
        run_git(
            path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "commit",
                "-m",
                message,
            ],
        );
    }

    fn run_git(path: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(path)
            .args(args)
            .output()
            .expect("git command runs");
        assert!(
            output.status.success(),
            "git command failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn reports_clean_head_with_provenance_note() {
        let path = temp_delivery_repo("clean");
        initialize_repo(&path);
        run_git(
            &path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "notes",
                "--ref",
                PROVENANCE_REF,
                "add",
                "-m",
                "{\"plan_step_id\":\"28.1\"}",
                "HEAD",
            ],
        );

        let readiness = inspect_git_delivery_readiness(path.clone()).expect("readiness inspected");
        assert!(readiness.worktree_clean);
        assert_eq!(readiness.changed_file_count, 0);
        assert_eq!(readiness.head_subject.as_deref(), Some("initial delivery"));
        assert!(readiness.head_provenance.present);
        assert_eq!(
            readiness.head_provenance.plan_step_id.as_deref(),
            Some("28.1")
        );
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn reports_dirty_files_and_missing_head_provenance() {
        let path = temp_delivery_repo("dirty");
        initialize_repo(&path);
        fs::write(path.join("README.md"), "# Delivery\n\nDirty.\n").expect("dirty readme");
        fs::write(path.join("TODO.md"), "ship later\n").expect("untracked todo");

        let readiness = inspect_git_delivery_readiness(path.clone()).expect("readiness inspected");
        assert!(!readiness.worktree_clean);
        assert_eq!(readiness.changed_file_count, 2);
        assert!(readiness
            .changed_files
            .iter()
            .any(|file| file.path == "README.md"));
        assert!(readiness
            .changed_files
            .iter()
            .any(|file| file.path == "TODO.md" && file.status == "??"));
        assert!(!readiness.head_provenance.present);
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn rejects_non_git_directories() {
        let path = temp_delivery_repo("not-git");
        let error = inspect_git_delivery_readiness(path.clone()).expect_err("non git rejected");
        assert!(matches!(error, AppError::InvalidInput(_)));
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn lists_recent_commits_with_optional_provenance_notes() {
        let path = temp_delivery_repo("history");
        initialize_repo(&path);
        run_git(
            &path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "notes",
                "--ref",
                PROVENANCE_REF,
                "add",
                "-m",
                "{\"plan_step_id\":\"28.1\",\"severity\":4,\"rationale\":\"Inspect delivery readiness.\"}",
                "HEAD",
            ],
        );
        fs::write(path.join("CHANGE.md"), "follow-up\n").expect("change written");
        run_git(&path, &["add", "."]);
        commit_all(&path, "unnoted follow-up");

        let history = list_git_delivery_provenance_history(path.clone(), 5).expect("history");
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].subject, "unnoted follow-up");
        assert!(!history[0].has_provenance);
        assert_eq!(history[1].subject, "initial delivery");
        assert!(history[1].has_provenance);
        assert_eq!(history[1].plan_step_id.as_deref(), Some("28.1"));
        assert_eq!(history[1].severity, Some(4));
        assert_eq!(
            history[1].rationale.as_deref(),
            Some("Inspect delivery readiness.")
        );
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn clamps_provenance_history_limit() {
        let path = temp_delivery_repo("history-limit");
        initialize_repo(&path);
        for index in 1..=3 {
            fs::write(path.join(format!("file-{index}.md")), format!("{index}\n"))
                .expect("file written");
            run_git(&path, &["add", "."]);
            commit_all(&path, &format!("commit {index}"));
        }

        let history = list_git_delivery_provenance_history(path.clone(), 0).expect("history");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].subject, "commit 3");
        let _ = fs::remove_dir_all(path);
    }
}
