use crate::errors::{AppError, AppResult};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    process::Command,
};

const PROVENANCE_REF: &str = "refs/notes/provenance";
const MAX_CHANGED_FILES: usize = 20;
const MAX_NOTE_PREVIEW_LENGTH: usize = 240;

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
    value
        .get("plan_step_id")
        .and_then(|plan_step_id| plan_step_id.as_str())
        .map(ToOwned::to_owned)
}

fn trim_note_preview(note: String) -> String {
    if note.len() <= MAX_NOTE_PREVIEW_LENGTH {
        return note;
    }
    format!("{}…", note[..MAX_NOTE_PREVIEW_LENGTH - 1].trim_end())
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
        run_git(
            path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "commit",
                "-m",
                "initial delivery",
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
}
