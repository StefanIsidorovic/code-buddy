use crate::{
    acp::AcpRegistryDistributionKind,
    errors::{AppError, AppResult},
};
use serde::Deserialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use uuid::Uuid;

const SECONDARY_WORKSPACE_PREFIX: &str = "aiadne-secondary-acp";
const SECONDARY_WORKSPACE_MOUNT: &str = "/work";
const SECONDARY_WORKSPACE_MAX_FILES: usize = 20_000;
const SECONDARY_WORKSPACE_MAX_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AcpWorkspaceIsolation {
    SnapshotSandbox,
}

#[derive(Debug)]
pub(crate) struct AcpLaunchContext {
    original_cwd: PathBuf,
    session_cwd: PathBuf,
    process_cwd: PathBuf,
    sandbox_program: Option<PathBuf>,
    workspace: Option<IsolatedAcpWorkspace>,
}

impl AcpLaunchContext {
    pub(crate) fn new(
        distribution: AcpRegistryDistributionKind,
        cwd: PathBuf,
        isolation: Option<AcpWorkspaceIsolation>,
    ) -> AppResult<Self> {
        Self::new_with_sandbox_program(distribution, cwd, isolation, which::which("bwrap").ok())
    }

    fn new_with_sandbox_program(
        distribution: AcpRegistryDistributionKind,
        cwd: PathBuf,
        isolation: Option<AcpWorkspaceIsolation>,
        sandbox_program: Option<PathBuf>,
    ) -> AppResult<Self> {
        match isolation {
            None => Ok(Self {
                process_cwd: acp_process_cwd(distribution, &cwd),
                session_cwd: cwd.clone(),
                original_cwd: cwd,
                sandbox_program: None,
                workspace: None,
            }),
            Some(AcpWorkspaceIsolation::SnapshotSandbox) => {
                let original_cwd = fs::canonicalize(&cwd)?;
                let workspace = IsolatedAcpWorkspace::create(&original_cwd)?;
                let sandbox_program = sandbox_program.ok_or_else(|| {
                    AppError::InvalidInput(
                        "isolated ACP workspace requires `bwrap` on PATH".to_string(),
                    )
                })?;
                Ok(Self {
                    original_cwd,
                    session_cwd: PathBuf::from(SECONDARY_WORKSPACE_MOUNT),
                    process_cwd: sandbox_process_cwd(distribution),
                    sandbox_program: Some(sandbox_program),
                    workspace: Some(workspace),
                })
            }
        }
    }

    pub(crate) fn command(&self, program: &str, args: &[String]) -> Command {
        if let (Some(sandbox_program), Some(workspace)) =
            (self.sandbox_program.as_deref(), self.workspace.as_ref())
        {
            sandboxed_registry_command(
                program,
                args,
                sandbox_program,
                workspace.path(),
                &self.original_cwd,
                &self.process_cwd,
            )
        } else {
            registry_command(program, args, &self.process_cwd)
        }
    }

    pub(crate) fn session_cwd(&self) -> PathBuf {
        self.session_cwd.clone()
    }

    pub(crate) fn into_workspace(self) -> Option<IsolatedAcpWorkspace> {
        self.workspace
    }
}

#[derive(Debug)]
pub(crate) struct IsolatedAcpWorkspace {
    root: PathBuf,
    workspace: PathBuf,
}

impl IsolatedAcpWorkspace {
    fn create(source: &Path) -> AppResult<Self> {
        if source.parent().is_none() {
            return Err(AppError::InvalidInput(
                "isolated ACP workspace requires a concrete repository directory".to_string(),
            ));
        }
        let root =
            std::env::temp_dir().join(format!("{}-{}", SECONDARY_WORKSPACE_PREFIX, Uuid::new_v4()));
        let workspace = root.join("workspace");
        fs::create_dir_all(&workspace)?;
        let lease = Self { root, workspace };
        let result = copy_workspace_snapshot(source, lease.path());
        if let Err(error) = result {
            let _ = fs::remove_dir_all(&lease.root);
            return Err(error);
        }
        Ok(lease)
    }

    fn path(&self) -> &Path {
        &self.workspace
    }
}

impl Drop for IsolatedAcpWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[derive(Default)]
struct SnapshotCopyBudget {
    files: usize,
    bytes: u64,
}

fn copy_workspace_snapshot(source: &Path, target: &Path) -> AppResult<()> {
    let mut budget = SnapshotCopyBudget::default();
    copy_workspace_dir(source, target, &mut budget)
}

fn copy_workspace_dir(
    source: &Path,
    target: &Path,
    budget: &mut SnapshotCopyBudget,
) -> AppResult<()> {
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_name = entry.file_name();
        if should_skip_snapshot_entry(&file_name.to_string_lossy()) {
            continue;
        }
        let source_path = entry.path();
        let target_path = target.join(&file_name);
        let metadata = fs::symlink_metadata(&source_path)?;
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            fs::create_dir_all(&target_path)?;
            copy_workspace_dir(&source_path, &target_path, budget)?;
        } else if metadata.is_file() {
            budget.files += 1;
            budget.bytes = budget.bytes.saturating_add(metadata.len());
            if budget.files > SECONDARY_WORKSPACE_MAX_FILES
                || budget.bytes > SECONDARY_WORKSPACE_MAX_BYTES
            {
                return Err(AppError::InvalidInput(
                    "isolated ACP workspace snapshot exceeds the supported size limit".to_string(),
                ));
            }
            fs::copy(&source_path, &target_path)?;
        }
    }
    Ok(())
}

fn should_skip_snapshot_entry(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | ".hg"
            | ".svn"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | "coverage"
            | ".next"
            | ".turbo"
            | ".cache"
    )
}

fn registry_command(program: &str, args: &[String], process_cwd: &Path) -> Command {
    let mut command = Command::new(program);
    command.args(args);
    command.current_dir(process_cwd);
    command
}

fn sandboxed_registry_command(
    program: &str,
    args: &[String],
    sandbox_program: &Path,
    workspace: &Path,
    original_cwd: &Path,
    process_cwd: &Path,
) -> Command {
    let mut command = Command::new(sandbox_program);
    command
        .arg("--die-with-parent")
        .arg("--ro-bind")
        .arg("/")
        .arg("/")
        .arg("--proc")
        .arg("/proc")
        .arg("--dev-bind")
        .arg("/dev")
        .arg("/dev")
        .arg("--tmpfs")
        .arg("/tmp")
        .arg("--setenv")
        .arg("TMPDIR")
        .arg("/tmp")
        .arg("--setenv")
        .arg("npm_config_cache")
        .arg("/tmp/npm-cache")
        .arg("--dir")
        .arg("/tmp/npm-cache")
        .arg("--dir")
        .arg(SECONDARY_WORKSPACE_MOUNT)
        .arg("--bind")
        .arg(workspace)
        .arg(SECONDARY_WORKSPACE_MOUNT)
        .arg("--bind")
        .arg(workspace)
        .arg(original_cwd)
        .arg("--chdir")
        .arg(process_cwd)
        .arg("--")
        .arg(program)
        .args(args);
    command.current_dir(std::env::temp_dir());
    command
}

fn sandbox_process_cwd(distribution: AcpRegistryDistributionKind) -> PathBuf {
    match distribution {
        AcpRegistryDistributionKind::Npx => PathBuf::from("/tmp"),
        AcpRegistryDistributionKind::Binary => PathBuf::from(SECONDARY_WORKSPACE_MOUNT),
    }
}

fn acp_process_cwd(distribution: AcpRegistryDistributionKind, project_cwd: &Path) -> PathBuf {
    match distribution {
        AcpRegistryDistributionKind::Npx => std::env::temp_dir(),
        AcpRegistryDistributionKind::Binary => project_cwd.to_path_buf(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_acp_test_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("aiadne-acp-{label}-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("temp acp test dir");
        path
    }

    fn leaked_secondary_workspace_with_marker(marker: &str) -> Vec<String> {
        let mut entries = fs::read_dir(std::env::temp_dir())
            .expect("temp dir readable")
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(SECONDARY_WORKSPACE_PREFIX)
                    && entry.path().join("workspace").join(marker).exists()
            })
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect::<Vec<_>>();
        entries.sort();
        entries
    }

    #[test]
    fn isolated_workspace_snapshot_skips_repo_metadata_and_generated_outputs() {
        let source = temp_acp_test_dir("snapshot-source");
        fs::create_dir_all(source.join("src")).expect("src dir");
        fs::create_dir_all(source.join(".git")).expect("git dir");
        fs::create_dir_all(source.join("node_modules/pkg")).expect("node_modules dir");
        fs::create_dir_all(source.join("target/debug")).expect("target dir");
        fs::create_dir_all(source.join("dist")).expect("dist dir");
        fs::write(source.join("src/lib.rs"), "pub fn ok() {}\n").expect("source file");
        fs::write(source.join(".git/config"), "[core]\n").expect("git file");
        fs::write(source.join("node_modules/pkg/index.js"), "x\n").expect("node file");
        fs::write(source.join("target/debug/app"), "x\n").expect("target file");
        fs::write(source.join("dist/app.js"), "x\n").expect("dist file");
        #[cfg(unix)]
        std::os::unix::fs::symlink("/etc/passwd", source.join("external-link")).expect("symlink");

        let workspace = IsolatedAcpWorkspace::create(&source).expect("snapshot created");
        let root = workspace.root.clone();

        assert!(workspace.path().join("src/lib.rs").is_file());
        assert!(!workspace.path().join(".git").exists());
        assert!(!workspace.path().join("node_modules").exists());
        assert!(!workspace.path().join("target").exists());
        assert!(!workspace.path().join("dist").exists());
        assert!(!workspace.path().join("external-link").exists());

        drop(workspace);
        assert!(!root.exists());
        let _ = fs::remove_dir_all(source);
    }

    #[test]
    fn sandboxed_registry_command_mounts_snapshot_as_agent_workspace() {
        let command = sandboxed_registry_command(
            "/usr/bin/npx",
            &["-y".into(), "@agentclientprotocol/codex-acp@1.1.0".into()],
            Path::new("/usr/bin/bwrap"),
            Path::new("/tmp/aiadne-secondary-acp-test/workspace"),
            Path::new("/home/katarina/projects/AIadne"),
            Path::new("/tmp"),
        );
        let args = command
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(command.get_program(), Path::new("/usr/bin/bwrap"));
        assert_eq!(command.get_current_dir(), Some(Path::new("/tmp")));
        assert!(args.windows(3).any(|items| items[0] == "--bind"
            && items[1] == "/tmp/aiadne-secondary-acp-test/workspace"
            && items[2] == SECONDARY_WORKSPACE_MOUNT));
        assert!(args.windows(3).any(|items| items[0] == "--bind"
            && items[1] == "/tmp/aiadne-secondary-acp-test/workspace"
            && items[2] == "/home/katarina/projects/AIadne"));
        assert!(args
            .windows(2)
            .any(|items| items[0] == "--chdir" && items[1] == "/tmp"));
        assert!(args
            .windows(3)
            .any(|items| items[0] == "--" && items[1] == "/usr/bin/npx" && items[2] == "-y"));
    }

    #[test]
    fn launch_context_keeps_regular_acp_startup_unwrapped() {
        let context = AcpLaunchContext::new_with_sandbox_program(
            AcpRegistryDistributionKind::Binary,
            PathBuf::from("/project/repo"),
            None,
            None,
        )
        .expect("regular launch context");
        let command = context.command("/usr/local/bin/kimi", &["acp".into()]);

        assert_eq!(context.session_cwd(), PathBuf::from("/project/repo"));
        assert_eq!(command.get_program(), Path::new("/usr/local/bin/kimi"));
        assert_eq!(command.get_current_dir(), Some(Path::new("/project/repo")));
    }

    #[test]
    fn isolated_launch_context_requires_bwrap_after_snapshot_cleanup() {
        let source = temp_acp_test_dir("missing-bwrap-source");
        let marker = format!("missing-bwrap-marker-{}.txt", Uuid::new_v4());
        fs::write(source.join(&marker), "marker\n").expect("source file");

        let error = AcpLaunchContext::new_with_sandbox_program(
            AcpRegistryDistributionKind::Npx,
            source.clone(),
            Some(AcpWorkspaceIsolation::SnapshotSandbox),
            None,
        )
        .expect_err("missing bwrap is rejected");

        assert!(error.to_string().contains("requires `bwrap`"));
        assert!(leaked_secondary_workspace_with_marker(&marker).is_empty());
        let _ = fs::remove_dir_all(source);
    }
}
