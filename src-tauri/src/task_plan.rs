use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

use crate::storage::TaskPlanVersionInfo;

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
}
