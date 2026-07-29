use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

use crate::storage::{TaskPlanStepInfo, TaskPlanVersionInfo};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanFindingInfo {
    pub id: String,
    pub code: String,
    pub severity: String,
    pub message: String,
    pub requirement_id: Option<String>,
    pub step_ids: Vec<String>,
}

pub fn eligible_execution_step_ids(
    steps: &[TaskPlanStepInfo],
    accepted_step_keys: &HashSet<String>,
) -> Vec<String> {
    execution_waves(steps)
        .into_iter()
        .find(|wave| {
            wave.iter()
                .any(|step| !accepted_step_keys.contains(&step_key(step.order_index)))
        })
        .unwrap_or_default()
        .into_iter()
        .filter(|step| !accepted_step_keys.contains(&step_key(step.order_index)))
        .map(|step| step.id.clone())
        .collect()
}

fn execution_waves(steps: &[TaskPlanStepInfo]) -> Vec<Vec<&TaskPlanStepInfo>> {
    let mut pending = steps.iter().collect::<Vec<_>>();
    pending.sort_by_key(|step| step.order_index);
    let mut completed = HashSet::new();
    let mut waves = Vec::new();
    while !pending.is_empty() {
        let ready = pending
            .iter()
            .copied()
            .filter(|step| {
                step.depends_on
                    .iter()
                    .all(|dependency| completed.contains(dependency))
            })
            .collect::<Vec<_>>();
        let candidates = if ready.is_empty() {
            pending.first().copied().into_iter().collect::<Vec<_>>()
        } else {
            ready
        };
        let mut selected = Vec::new();
        for candidate in candidates {
            let has_declared_scope = !candidate.expected_paths.is_empty();
            let compatible = has_declared_scope
                && selected.iter().all(|step: &&TaskPlanStepInfo| {
                    !step.expected_paths.is_empty()
                        && !scopes_overlap(&step.expected_paths, &candidate.expected_paths)
                });
            if selected.is_empty() || compatible {
                selected.push(candidate);
            }
            if !has_declared_scope && selected.len() == 1 {
                break;
            }
        }
        for step in &selected {
            completed.insert(step_key(step.order_index));
            pending.retain(|pending_step| pending_step.id != step.id);
        }
        waves.push(selected);
    }
    waves
}

fn step_key(order_index: i64) -> String {
    format!("STEP-{}", order_index + 1)
}

fn scopes_overlap(left: &[String], right: &[String]) -> bool {
    left.iter().any(|left_path| {
        right.iter().any(|right_path| {
            let left_prefix = scope_prefix(left_path);
            let right_prefix = scope_prefix(right_path);
            left_prefix.is_empty()
                || right_prefix.is_empty()
                || left_prefix == right_prefix
                || left_prefix.starts_with(&format!("{right_prefix}/"))
                || right_prefix.starts_with(&format!("{left_prefix}/"))
        })
    })
}

fn scope_prefix(value: &str) -> &str {
    let value = value.trim().strip_prefix("./").unwrap_or(value.trim());
    let wildcard = value
        .char_indices()
        .find(|(_, character)| matches!(character, '*' | '?' | '[' | '{'))
        .map(|(index, _)| index)
        .unwrap_or(value.len());
    value[..wildcard].trim_end_matches('/')
}

pub fn evaluate(plan: &TaskPlanVersionInfo) -> (String, Vec<TaskPlanFindingInfo>) {
    let mut findings = Vec::new();
    let covered = plan
        .steps
        .iter()
        .flat_map(|step| step.satisfies.iter())
        .cloned()
        .collect::<HashSet<_>>();
    for requirement in &plan.requirements {
        if requirement.kind != "out_of_scope" && !covered.contains(&requirement.id) {
            findings.push(TaskPlanFindingInfo {
                id: format!("GAP:{}", requirement.id),
                code: "GAP".into(),
                severity: "blocking".into(),
                message: format!(
                    "{} is not satisfied by any implementation step.",
                    requirement.id
                ),
                requirement_id: Some(requirement.id.clone()),
                step_ids: Vec::new(),
            });
        }
        if requirement.kind == "out_of_scope" {
            let steps = plan
                .steps
                .iter()
                .filter(|step| step.satisfies.contains(&requirement.id))
                .map(|step| step.id.clone())
                .collect::<Vec<_>>();
            if !steps.is_empty() {
                findings.push(TaskPlanFindingInfo {
                    id: format!("OUT_OF_SCOPE:{}", requirement.id),
                    code: "OUT_OF_SCOPE".into(),
                    severity: "blocking".into(),
                    message: format!(
                        "{} is declared out of scope but is assigned to a step.",
                        requirement.id
                    ),
                    requirement_id: Some(requirement.id.clone()),
                    step_ids: steps,
                });
            }
        }
    }
    for step in &plan.steps {
        if step.kind == "implementation" && step.expected_paths.is_empty() {
            findings.push(TaskPlanFindingInfo {
                id: format!("MISSING_PATHS:{}", step.id),
                code: "MISSING_PATHS".into(),
                severity: "warning".into(),
                message: format!("Step {} has no expected write paths.", step.order_index + 1),
                requirement_id: None,
                step_ids: vec![step.id.clone()],
            });
        }
    }
    let mut paths: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    for step in &plan.steps {
        for path in &step.expected_paths {
            paths.entry(path).or_default().push(&step.id);
        }
    }
    for (path, step_ids) in paths {
        if step_ids.len() > 1 {
            findings.push(TaskPlanFindingInfo {
                id: format!("PATH_COLLISION:{path}"),
                code: "PATH_COLLISION".into(),
                severity: "warning".into(),
                message: format!("Multiple steps claim the same expected path: {path}."),
                requirement_id: None,
                step_ids: step_ids.into_iter().map(String::from).collect(),
            });
        }
    }
    let verdict = if findings
        .iter()
        .any(|finding| finding.severity == "blocking")
    {
        "blocked"
    } else if findings.is_empty() {
        "clean"
    } else {
        "flags"
    };
    (verdict.into(), findings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::{TaskPlanRequirementInfo, TaskPlanStepInfo};

    fn plan() -> TaskPlanVersionInfo {
        TaskPlanVersionInfo {
            id: "plan-1".into(),
            task_id: "task-1".into(),
            version: 1,
            status: "draft".into(),
            source_artifact_id: "artifact-1".into(),
            created_at: 1,
            approved_at: None,
            requirements: vec![
                TaskPlanRequirementInfo {
                    id: "REQ-1".into(),
                    text: "Covered".into(),
                    kind: "functional".into(),
                    order_index: 0,
                },
                TaskPlanRequirementInfo {
                    id: "REQ-2".into(),
                    text: "Missing".into(),
                    kind: "functional".into(),
                    order_index: 1,
                },
            ],
            steps: vec![TaskPlanStepInfo {
                id: "step-1".into(),
                order_index: 0,
                title: "Implement".into(),
                description: "Change".into(),
                kind: "implementation".into(),
                complexity: 2,
                acceptance_criteria: vec!["Pass".into()],
                expected_paths: vec![],
                satisfies: vec!["REQ-1".into()],
                depends_on: vec![],
            }],
        }
    }

    #[test]
    fn blocks_gaps_and_flags_missing_paths() {
        let (verdict, findings) = evaluate(&plan());
        assert_eq!(verdict, "blocked");
        assert!(findings.iter().any(|finding| finding.id == "GAP:REQ-2"));
        assert!(findings
            .iter()
            .any(|finding| finding.code == "MISSING_PATHS"));
    }

    #[test]
    fn flags_shared_write_scopes_without_inventing_dependencies() {
        let mut value = plan();
        value.requirements.pop();
        value.steps[0].expected_paths = vec!["src/**".into()];
        value.steps.push(TaskPlanStepInfo {
            id: "step-2".into(),
            order_index: 1,
            title: "Test".into(),
            description: "Add tests".into(),
            kind: "implementation".into(),
            complexity: 2,
            acceptance_criteria: vec!["Pass".into()],
            expected_paths: vec!["src/**".into()],
            satisfies: vec!["REQ-1".into()],
            depends_on: vec![],
        });
        let (verdict, findings) = evaluate(&value);
        assert_eq!(verdict, "flags");
        assert_eq!(findings[0].id, "PATH_COLLISION:src/**");
    }

    #[test]
    fn derives_dependency_and_scope_safe_execution_eligibility() {
        let mut value = plan();
        value.requirements.pop();
        value.steps[0].expected_paths = vec!["src/auth/**".into()];
        value.steps.push(TaskPlanStepInfo {
            id: "step-2".into(),
            order_index: 1,
            title: "Independent".into(),
            description: "Change docs".into(),
            kind: "implementation".into(),
            complexity: 2,
            acceptance_criteria: vec!["Pass".into()],
            expected_paths: vec!["docs/**".into()],
            satisfies: vec!["REQ-1".into()],
            depends_on: vec![],
        });
        value.steps.push(TaskPlanStepInfo {
            id: "step-3".into(),
            order_index: 2,
            title: "Overlapping".into(),
            description: "Change auth tests".into(),
            kind: "implementation".into(),
            complexity: 2,
            acceptance_criteria: vec!["Pass".into()],
            expected_paths: vec!["src/auth/tests/**".into()],
            satisfies: vec!["REQ-1".into()],
            depends_on: vec![],
        });
        value.steps.push(TaskPlanStepInfo {
            id: "step-4".into(),
            order_index: 3,
            title: "Dependent".into(),
            description: "Use auth change".into(),
            kind: "implementation".into(),
            complexity: 2,
            acceptance_criteria: vec!["Pass".into()],
            expected_paths: vec!["src/client/**".into()],
            satisfies: vec!["REQ-1".into()],
            depends_on: vec!["STEP-1".into()],
        });

        assert_eq!(
            eligible_execution_step_ids(&value.steps, &HashSet::new()),
            ["step-1", "step-2"]
        );
        assert_eq!(
            eligible_execution_step_ids(&value.steps, &HashSet::from(["STEP-1".into()])),
            ["step-2"]
        );
        assert_eq!(
            eligible_execution_step_ids(
                &value.steps,
                &HashSet::from(["STEP-1".into(), "STEP-2".into()])
            ),
            ["step-3", "step-4"]
        );
    }

    #[test]
    fn serializes_missing_write_scope() {
        let mut value = plan();
        value.requirements.pop();
        value.steps.push(TaskPlanStepInfo {
            id: "step-2".into(),
            order_index: 1,
            title: "Scoped".into(),
            description: "Change docs".into(),
            kind: "implementation".into(),
            complexity: 2,
            acceptance_criteria: vec!["Pass".into()],
            expected_paths: vec!["docs/**".into()],
            satisfies: vec!["REQ-1".into()],
            depends_on: vec![],
        });

        assert_eq!(
            eligible_execution_step_ids(&value.steps, &HashSet::new()),
            ["step-1"]
        );
    }
}
