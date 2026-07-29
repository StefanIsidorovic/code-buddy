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
    if !git(&repository_path, &["status", "--porcelain"])?.is_empty() {
        return Err(AppError::InvalidInput(
            "parallel step isolation requires a clean source repository".into(),
        ));
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
        assert!(dirty.to_string().contains("clean source"));
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
}
