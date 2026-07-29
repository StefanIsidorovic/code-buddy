use crate::errors::{AppError, AppResult};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

const WORKTREE_ROOT: &str = "aiadne-task-worktrees";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskStepWorktreeInfo {
    pub isolation_id: String,
    pub repository_path: PathBuf,
    pub worktree_path: PathBuf,
    pub branch: String,
    pub base_sha: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskStepIntegrationInfo {
    pub isolated_commit_sha: String,
    pub integrated_commit_sha: String,
}

pub fn prepare_task_step_worktree(
    repository_path: &Path,
    task_id: &str,
    step_order: usize,
    attempt: usize,
    isolation_id: &str,
) -> AppResult<TaskStepWorktreeInfo> {
    if step_order == 0 || attempt == 0 {
        return Err(AppError::InvalidInput(
            "step worktree needs positive step and attempt numbers".into(),
        ));
    }
    let repository_path = canonical_repository_root(repository_path)?;
    let source_status = git(&repository_path, &["status", "--porcelain"])?;
    if !source_status.is_empty() {
        return Err(AppError::InvalidInput(dirty_source_error(
            "parallel step isolation",
            &source_status,
        )));
    }
    let identity = safe_identity(isolation_id)?;
    let task = safe_identity(task_id)?;
    let base_sha = git(&repository_path, &["rev-parse", "HEAD"])?;
    let worktree_root = std::env::temp_dir().join(WORKTREE_ROOT);
    fs::create_dir_all(&worktree_root)?;
    let worktree_path = worktree_root.join(&identity);
    if worktree_path.exists() {
        return Err(AppError::InvalidInput(
            "step isolation identity already has a worktree".into(),
        ));
    }
    let branch = format!("aiadne/{task}/step-{step_order}/attempt-{attempt}-{identity}");
    if git_status(
        &repository_path,
        &[
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch}"),
        ],
    )? {
        return Err(AppError::InvalidInput(
            "step isolation identity already has a branch".into(),
        ));
    }

    if let Err(error) = run_git(
        &repository_path,
        &[
            "worktree",
            "add",
            "--detach",
            path_text(&worktree_path)?,
            &base_sha,
        ],
    ) {
        rollback_worktree(&repository_path, &worktree_path);
        return Err(error);
    }
    if let Err(error) = run_git(&worktree_path, &["switch", "-c", &branch]) {
        rollback_worktree(&repository_path, &worktree_path);
        return Err(error);
    }

    Ok(TaskStepWorktreeInfo {
        isolation_id: identity,
        repository_path,
        worktree_path,
        branch,
        base_sha,
    })
}

fn dirty_source_error(operation: &str, status: &str) -> String {
    const SHOWN_PATH_LIMIT: usize = 5;
    let paths = status
        .lines()
        .filter_map(|line| line.get(3..))
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .collect::<Vec<_>>();
    let shown = paths
        .iter()
        .take(SHOWN_PATH_LIMIT)
        .copied()
        .collect::<Vec<_>>()
        .join(", ");
    let remainder = paths.len().saturating_sub(SHOWN_PATH_LIMIT);
    let suffix = if remainder == 0 {
        String::new()
    } else {
        format!(" (+{remainder} more)")
    };
    format!(
        "{operation} requires a clean source repository. Commit, stash, or discard existing changes first: {shown}{suffix}"
    )
}

pub fn remove_task_step_worktree(info: &TaskStepWorktreeInfo) -> AppResult<()> {
    let repository_path = canonical_repository_root(&info.repository_path)?;
    let expected_root = std::env::temp_dir().join(WORKTREE_ROOT);
    if info.worktree_path.parent() != Some(expected_root.as_path())
        || !info.branch.starts_with("aiadne/")
    {
        return Err(AppError::InvalidInput(
            "refusing to remove a worktree outside AIadne isolation".into(),
        ));
    }
    run_git(
        &repository_path,
        &[
            "worktree",
            "remove",
            "--force",
            path_text(&info.worktree_path)?,
        ],
    )?;
    run_git(&repository_path, &["branch", "-D", &info.branch])?;
    Ok(())
}

pub fn integrate_task_step_worktree(
    info: &TaskStepWorktreeInfo,
    task_id: &str,
    plan_step_id: &str,
    run_id: &str,
) -> AppResult<TaskStepIntegrationInfo> {
    let repository_path = canonical_repository_root(&info.repository_path)?;
    validate_owned_worktree(info)?;
    if !git(&repository_path, &["status", "--porcelain"])?.is_empty() {
        return Err(AppError::InvalidInput(
            "isolated integration requires a clean source repository".into(),
        ));
    }
    if git(&info.worktree_path, &["branch", "--show-current"])? != info.branch {
        return Err(AppError::InvalidInput(
            "isolated integration branch does not match its descriptor".into(),
        ));
    }
    if git(&info.worktree_path, &["rev-parse", "HEAD"])? != info.base_sha {
        return Err(AppError::InvalidInput(
            "isolated step must not create commits before AIadne integration".into(),
        ));
    }
    if git(&info.worktree_path, &["status", "--porcelain"])?.is_empty() {
        return Err(AppError::InvalidInput(
            "isolated integration requires repository changes".into(),
        ));
    }
    let task_id = safe_identity(task_id)?;
    let plan_step_id = safe_identity(plan_step_id)?;
    let run_id = safe_identity(run_id)?;
    run_git(&info.worktree_path, &["add", "-A"])?;
    let subject = format!("aiadne: integrate {plan_step_id}");
    run_git(
        &info.worktree_path,
        &[
            "-c",
            "user.name=AIadne",
            "-c",
            "user.email=aiadne@local.invalid",
            "commit",
            "-m",
            &subject,
        ],
    )?;
    let isolated_commit_sha = git(&info.worktree_path, &["rev-parse", "HEAD"])?;
    let provenance = serde_json::json!({
        "task_id": task_id,
        "plan_step_id": plan_step_id,
        "run_id": run_id,
        "base_sha": info.base_sha,
        "source": "aiadne-isolated-step"
    })
    .to_string();
    add_provenance_note(&info.worktree_path, &isolated_commit_sha, &provenance)?;

    if !git(&repository_path, &["status", "--porcelain"])?.is_empty() {
        return Err(AppError::InvalidInput(
            "source repository changed before isolated integration".into(),
        ));
    }
    if let Err(error) = run_git(&repository_path, &["cherry-pick", &isolated_commit_sha]) {
        let _ = run_git(&repository_path, &["cherry-pick", "--abort"]);
        return Err(AppError::InvalidInput(format!(
            "isolated step integration conflicted and was aborted: {error}"
        )));
    }
    let integrated_commit_sha = git(&repository_path, &["rev-parse", "HEAD"])?;
    add_provenance_note(&repository_path, &integrated_commit_sha, &provenance)?;
    Ok(TaskStepIntegrationInfo {
        isolated_commit_sha,
        integrated_commit_sha,
    })
}

fn validate_owned_worktree(info: &TaskStepWorktreeInfo) -> AppResult<()> {
    let expected_root = std::env::temp_dir().join(WORKTREE_ROOT);
    if info.worktree_path.parent() != Some(expected_root.as_path())
        || !info.branch.starts_with("aiadne/")
        || !info.worktree_path.is_dir()
    {
        return Err(AppError::InvalidInput(
            "worktree is outside AIadne isolation ownership".into(),
        ));
    }
    Ok(())
}

fn add_provenance_note(repository_path: &Path, commit: &str, note: &str) -> AppResult<()> {
    run_git(
        repository_path,
        &[
            "notes",
            "--ref=refs/notes/provenance",
            "add",
            "-m",
            note,
            commit,
        ],
    )
}

fn canonical_repository_root(path: &Path) -> AppResult<PathBuf> {
    let canonical = path.canonicalize()?;
    let root = PathBuf::from(git(&canonical, &["rev-parse", "--show-toplevel"])?).canonicalize()?;
    if root != canonical {
        return Err(AppError::InvalidInput(
            "step isolation requires the Git repository root".into(),
        ));
    }
    Ok(canonical)
}

fn safe_identity(value: &str) -> AppResult<String> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 64
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err(AppError::InvalidInput(
            "step isolation identity must contain only letters, numbers, or hyphens".into(),
        ));
    }
    Ok(value.to_ascii_lowercase())
}

fn path_text(path: &Path) -> AppResult<&str> {
    path.to_str()
        .ok_or_else(|| AppError::InvalidInput("step worktree path is not valid UTF-8".into()))
}

fn git(repository_path: &Path, args: &[&str]) -> AppResult<String> {
    let output = Command::new("git")
        .current_dir(repository_path)
        .args(args)
        .output()?;
    if !output.status.success() {
        return Err(AppError::InvalidInput(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn run_git(repository_path: &Path, args: &[&str]) -> AppResult<()> {
    git(repository_path, args).map(|_| ())
}

fn git_status(repository_path: &Path, args: &[&str]) -> AppResult<bool> {
    Ok(Command::new("git")
        .current_dir(repository_path)
        .args(args)
        .status()?
        .success())
}

fn rollback_worktree(repository_path: &Path, worktree_path: &Path) {
    if let Ok(path) = path_text(worktree_path) {
        let _ = run_git(repository_path, &["worktree", "remove", "--force", path]);
    }
    let _ = fs::remove_dir_all(worktree_path);
    let _ = run_git(repository_path, &["worktree", "prune"]);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn repository(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("aiadne-worktree-{label}-{nonce}"));
        fs::create_dir_all(&path).expect("repo directory");
        run_git(&path, &["init", "-q"]).expect("git init");
        run_git(&path, &["config", "user.email", "aiadne@example.test"]).expect("email");
        run_git(&path, &["config", "user.name", "AIadne Test"]).expect("name");
        fs::write(path.join("README.md"), "main\n").expect("seed file");
        run_git(&path, &["add", "README.md"]).expect("add");
        run_git(&path, &["commit", "-q", "-m", "initial"]).expect("commit");
        path
    }

    #[test]
    fn isolates_step_changes_from_the_source_checkout() {
        let repository = repository("isolated");
        let info = prepare_task_step_worktree(&repository, "task-123", 2, 1, "run-123")
            .expect("worktree prepared");
        assert_eq!(
            git(&info.worktree_path, &["branch", "--show-current"]).expect("branch"),
            info.branch
        );
        assert_eq!(
            git(&info.worktree_path, &["rev-parse", "HEAD"]).expect("worktree head"),
            info.base_sha
        );
        fs::write(info.worktree_path.join("README.md"), "isolated\n").expect("isolated edit");
        assert_eq!(
            fs::read_to_string(repository.join("README.md")).expect("main file"),
            "main\n"
        );
        remove_task_step_worktree(&info).expect("cleanup");
        assert!(!info.worktree_path.exists());
        let _ = fs::remove_dir_all(repository);
    }

    #[test]
    fn rejects_dirty_sources_and_duplicate_isolation_identity() {
        let repository = repository("guards");
        fs::write(repository.join("dirty.txt"), "dirty").expect("dirty file");
        let dirty = prepare_task_step_worktree(&repository, "task-123", 1, 1, "dirty-run")
            .expect_err("dirty repository rejected");
        let message = dirty.to_string();
        assert!(message.contains("clean source"));
        assert!(message.contains("Commit, stash, or discard"));
        assert!(message.contains("dirty.txt"));
        fs::remove_file(repository.join("dirty.txt")).expect("remove dirty file");

        let info = prepare_task_step_worktree(&repository, "task-123", 1, 1, "same-run")
            .expect("first isolation");
        let duplicate = prepare_task_step_worktree(&repository, "task-123", 1, 1, "same-run")
            .expect_err("duplicate rejected");
        assert!(duplicate.to_string().contains("already has"));
        remove_task_step_worktree(&info).expect("cleanup");
        let _ = fs::remove_dir_all(repository);
    }

    #[test]
    fn rejects_unsafe_identities_and_cleanup_targets() {
        let repository = repository("unsafe");
        let unsafe_identity =
            prepare_task_step_worktree(&repository, "task-123", 1, 1, "../escape")
                .expect_err("path traversal rejected");
        assert!(unsafe_identity.to_string().contains("only letters"));

        let unsafe_cleanup = remove_task_step_worktree(&TaskStepWorktreeInfo {
            isolation_id: "fake".into(),
            repository_path: repository.clone(),
            worktree_path: repository.join("not-an-isolation"),
            branch: "main".into(),
            base_sha: "fake".into(),
        })
        .expect_err("non-AIadne target rejected");
        assert!(unsafe_cleanup.to_string().contains("refusing"));
        assert!(repository.exists());
        let _ = fs::remove_dir_all(repository);
    }

    #[test]
    fn commits_and_integrates_isolated_changes_after_source_advances() {
        let repository = repository("integration");
        let info = prepare_task_step_worktree(&repository, "task-123", 1, 1, "integration-run")
            .expect("worktree prepared");
        fs::write(info.worktree_path.join("step.txt"), "step\n").expect("step edit");
        fs::write(repository.join("source.txt"), "source\n").expect("source edit");
        run_git(&repository, &["add", "source.txt"]).expect("source add");
        run_git(&repository, &["commit", "-q", "-m", "source advanced"]).expect("source commit");

        let integrated = integrate_task_step_worktree(&info, "task-123", "step-1", "run-123")
            .expect("step integrated");
        assert_ne!(
            integrated.isolated_commit_sha,
            integrated.integrated_commit_sha
        );
        assert_eq!(
            fs::read_to_string(repository.join("step.txt")).expect("integrated file"),
            "step\n"
        );
        let note = git(
            &repository,
            &[
                "notes",
                "--ref=refs/notes/provenance",
                "show",
                &integrated.integrated_commit_sha,
            ],
        )
        .expect("provenance note");
        assert!(note.contains(r#""plan_step_id":"step-1""#));
        remove_task_step_worktree(&info).expect("cleanup");
        let _ = fs::remove_dir_all(repository);
    }

    #[test]
    fn rejects_empty_changes_and_aborts_conflicting_integration() {
        let repository = repository("conflict");
        let empty = prepare_task_step_worktree(&repository, "task-123", 1, 1, "empty-run")
            .expect("empty worktree");
        assert!(integrate_task_step_worktree(&empty, "task-123", "step-1", "empty-run",).is_err());
        remove_task_step_worktree(&empty).expect("empty cleanup");

        let precommitted =
            prepare_task_step_worktree(&repository, "task-123", 1, 2, "precommitted-run")
                .expect("precommitted worktree");
        fs::write(precommitted.worktree_path.join("agent.txt"), "agent\n").expect("agent edit");
        run_git(&precommitted.worktree_path, &["add", "agent.txt"]).expect("agent add");
        run_git(
            &precommitted.worktree_path,
            &[
                "-c",
                "user.name=Agent",
                "-c",
                "user.email=agent@example.test",
                "commit",
                "-q",
                "-m",
                "agent commit",
            ],
        )
        .expect("agent commit");
        let precommitted_error =
            integrate_task_step_worktree(&precommitted, "task-123", "step-1", "precommitted-run")
                .expect_err("agent commit rejected");
        assert!(precommitted_error
            .to_string()
            .contains("must not create commits"));
        remove_task_step_worktree(&precommitted).expect("precommitted cleanup");

        let conflict = prepare_task_step_worktree(&repository, "task-123", 1, 3, "conflict-run")
            .expect("conflict worktree");
        fs::write(conflict.worktree_path.join("README.md"), "isolated\n").expect("isolated edit");
        fs::write(repository.join("README.md"), "source\n").expect("source edit");
        run_git(&repository, &["add", "README.md"]).expect("source add");
        run_git(&repository, &["commit", "-q", "-m", "conflicting source"]).expect("source commit");
        let source_head = git(&repository, &["rev-parse", "HEAD"]).expect("source head");

        let error = integrate_task_step_worktree(&conflict, "task-123", "step-1", "conflict-run")
            .expect_err("conflict blocked");
        assert!(error.to_string().contains("conflicted and was aborted"));
        assert_eq!(
            git(&repository, &["rev-parse", "HEAD"]).expect("head"),
            source_head
        );
        assert!(git(&repository, &["status", "--porcelain"])
            .expect("status")
            .is_empty());
        assert!(conflict.worktree_path.exists());
        remove_task_step_worktree(&conflict).expect("conflict cleanup");
        let _ = fs::remove_dir_all(repository);
    }
}
