use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::{
    storage::{
        CreateTaskPlanVersionRequest, TaskPlanRequirementInput, TaskPlanStepInput,
        TaskPlanVersionInfo,
    },
    task_plan::TaskPlanFindingInfo,
};

const MAX_PRIMARY_ISSUES: usize = 3;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanCritiqueIssue {
    pub finding_ids: Vec<String>,
    pub explanation: String,
    pub proposed_repair: String,
    #[serde(default)]
    pub repairs: Vec<TaskPlanRepair>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum TaskPlanRepair {
    AddStep {
        title: String,
        description: String,
        complexity: i64,
        acceptance_criteria: Vec<String>,
        expected_paths: Vec<String>,
        satisfies: Vec<String>,
    },
    SetStepExpectedPaths {
        step_id: String,
        expected_paths: Vec<String>,
    },
    SetStepRequirements {
        step_id: String,
        satisfies: Vec<String>,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CritiqueEnvelope {
    issues: Vec<TaskPlanCritiqueIssue>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CritiqueContext<'a> {
    plan_version: i64,
    requirements: Vec<CritiqueRequirement<'a>>,
    steps: Vec<CritiqueStep<'a>>,
    findings: &'a [TaskPlanFindingInfo],
}

#[derive(Serialize)]
struct CritiqueRequirement<'a> {
    id: &'a str,
    text: &'a str,
    kind: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CritiqueStep<'a> {
    id: &'a str,
    order_index: i64,
    title: &'a str,
    description: &'a str,
    acceptance_criteria: &'a [String],
    expected_paths: &'a [String],
    satisfies: &'a [String],
}

pub fn critique_instruction(
    plan: &TaskPlanVersionInfo,
    findings: &[TaskPlanFindingInfo],
) -> Result<String, serde_json::Error> {
    let context = CritiqueContext {
        plan_version: plan.version,
        requirements: plan
            .requirements
            .iter()
            .map(|item| CritiqueRequirement {
                id: &item.id,
                text: &item.text,
                kind: &item.kind,
            })
            .collect(),
        steps: plan
            .steps
            .iter()
            .map(|item| CritiqueStep {
                id: &item.id,
                order_index: item.order_index,
                title: &item.title,
                description: &item.description,
                acceptance_criteria: &item.acceptance_criteria,
                expected_paths: &item.expected_paths,
                satisfies: &item.satisfies,
            })
            .collect(),
        findings,
    };
    let context_json = serde_json::to_string(&context)?;
    Ok(format!(
        "Critique only the deterministic findings in the supplied structured plan context.\n\
         Return JSON only: {{\"issues\":[{{\"findingIds\":[\"exact persisted finding ID\"],\
         \"explanation\":\"short impact\",\"proposedRepair\":\"specific plan edit\",\
         \"repairs\":[{{\"kind\":\"set_step_expected_paths\",\"stepId\":\"exact step ID\",\
         \"expectedPaths\":[\"path\"]}}]}}]}}.\n\
         Return at most {MAX_PRIMARY_ISSUES} issues, ordered by user impact. Every issue must cite \
         at least one exact finding ID from the context and contain at least one typed repair. \
         Allowed repair kinds are add_step, set_step_expected_paths, and set_step_requirements. \
         Use only exact requirement and step IDs from context except for a new add_step. Do not \
         invent findings, inspect files, execute code, rewrite the plan, or claim a repair was applied.\n\
         CONTEXT_JSON:\n{context_json}"
    ))
}

pub fn grounded_issues(
    response: &str,
    plan: &TaskPlanVersionInfo,
    findings: &[TaskPlanFindingInfo],
) -> Vec<TaskPlanCritiqueIssue> {
    let Some(json) = json_object(response) else {
        return Vec::new();
    };
    let Ok(envelope) = serde_json::from_str::<CritiqueEnvelope>(json) else {
        return Vec::new();
    };
    let supported = findings
        .iter()
        .map(|finding| finding.id.as_str())
        .collect::<HashSet<_>>();
    envelope
        .issues
        .into_iter()
        .filter_map(|mut issue| {
            issue
                .finding_ids
                .retain(|id| supported.contains(id.as_str()));
            issue.finding_ids.sort();
            issue.finding_ids.dedup();
            issue.explanation = issue.explanation.trim().to_string();
            issue.proposed_repair = issue.proposed_repair.trim().to_string();
            issue
                .repairs
                .retain_mut(|repair| normalize_repair(repair, plan));
            (!issue.finding_ids.is_empty()
                && !issue.explanation.is_empty()
                && !issue.proposed_repair.is_empty()
                && !issue.repairs.is_empty())
            .then_some(issue)
        })
        .take(MAX_PRIMARY_ISSUES)
        .collect()
}

fn normalize_repair(repair: &mut TaskPlanRepair, plan: &TaskPlanVersionInfo) -> bool {
    let declared = plan
        .requirements
        .iter()
        .filter(|item| item.kind != "out_of_scope")
        .map(|item| item.id.as_str())
        .collect::<HashSet<_>>();
    match repair {
        TaskPlanRepair::AddStep {
            title,
            description,
            complexity,
            acceptance_criteria,
            expected_paths,
            satisfies,
        } => {
            *title = title.trim().to_string();
            *description = description.trim().to_string();
            normalize_list(acceptance_criteria);
            normalize_list(expected_paths);
            normalize_list(satisfies);
            !title.is_empty()
                && !description.is_empty()
                && (1..=5).contains(complexity)
                && !acceptance_criteria.is_empty()
                && !expected_paths.is_empty()
                && !satisfies.is_empty()
                && satisfies.iter().all(|id| declared.contains(id.as_str()))
        }
        TaskPlanRepair::SetStepExpectedPaths {
            step_id,
            expected_paths,
        } => {
            *step_id = step_id.trim().to_string();
            normalize_list(expected_paths);
            plan.steps.iter().any(|step| step.id == *step_id) && !expected_paths.is_empty()
        }
        TaskPlanRepair::SetStepRequirements { step_id, satisfies } => {
            *step_id = step_id.trim().to_string();
            normalize_list(satisfies);
            plan.steps.iter().any(|step| step.id == *step_id)
                && !satisfies.is_empty()
                && satisfies.iter().all(|id| declared.contains(id.as_str()))
        }
    }
}

fn normalize_list(values: &mut Vec<String>) {
    values
        .iter_mut()
        .for_each(|value| *value = value.trim().to_string());
    values.retain(|value| !value.is_empty());
    values.sort();
    values.dedup();
}

pub fn repair_draft(
    plan: &TaskPlanVersionInfo,
    issues: &[TaskPlanCritiqueIssue],
) -> Result<CreateTaskPlanVersionRequest, String> {
    let requirements = plan
        .requirements
        .iter()
        .map(|item| TaskPlanRequirementInput {
            id: item.id.clone(),
            text: item.text.clone(),
            kind: item.kind.clone(),
        })
        .collect();
    let mut step_ids = plan
        .steps
        .iter()
        .map(|item| item.id.clone())
        .collect::<Vec<_>>();
    let mut steps = plan
        .steps
        .iter()
        .map(|item| TaskPlanStepInput {
            title: item.title.clone(),
            description: item.description.clone(),
            kind: item.kind.clone(),
            complexity: item.complexity,
            acceptance_criteria: item.acceptance_criteria.clone(),
            expected_paths: item.expected_paths.clone(),
            satisfies: item.satisfies.clone(),
        })
        .collect::<Vec<_>>();
    for repair in issues.iter().flat_map(|issue| &issue.repairs) {
        match repair {
            TaskPlanRepair::AddStep {
                title,
                description,
                complexity,
                acceptance_criteria,
                expected_paths,
                satisfies,
            } => {
                step_ids.push(String::new());
                steps.push(TaskPlanStepInput {
                    title: title.clone(),
                    description: description.clone(),
                    kind: "implementation".into(),
                    complexity: *complexity,
                    acceptance_criteria: acceptance_criteria.clone(),
                    expected_paths: expected_paths.clone(),
                    satisfies: satisfies.clone(),
                });
            }
            TaskPlanRepair::SetStepExpectedPaths {
                step_id,
                expected_paths,
            } => {
                let index = step_ids
                    .iter()
                    .position(|id| id == step_id)
                    .ok_or_else(|| format!("repair step not found: {step_id}"))?;
                steps[index].expected_paths = expected_paths.clone();
            }
            TaskPlanRepair::SetStepRequirements { step_id, satisfies } => {
                let index = step_ids
                    .iter()
                    .position(|id| id == step_id)
                    .ok_or_else(|| format!("repair step not found: {step_id}"))?;
                steps[index].satisfies = satisfies.clone();
            }
        }
    }
    Ok(CreateTaskPlanVersionRequest {
        task_id: plan.task_id.clone(),
        source_artifact_id: plan.source_artifact_id.clone(),
        requirements,
        steps,
    })
}

fn json_object(response: &str) -> Option<&str> {
    let start = response.find('{')?;
    let end = response.rfind('}')?;
    (start <= end).then_some(&response[start..=end])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::{TaskPlanRequirementInfo, TaskPlanStepInfo};

    fn finding(id: &str) -> TaskPlanFindingInfo {
        TaskPlanFindingInfo {
            id: id.into(),
            code: "GAP".into(),
            severity: "blocking".into(),
            message: "Requirement is uncovered.".into(),
            requirement_id: Some("REQ-1".into()),
            step_ids: Vec::new(),
        }
    }

    fn plan() -> TaskPlanVersionInfo {
        TaskPlanVersionInfo {
            id: "private-plan-id".into(),
            task_id: "private-task-id".into(),
            version: 2,
            status: "draft".into(),
            source_artifact_id: "private-artifact-id".into(),
            created_at: 42,
            approved_at: None,
            requirements: vec![TaskPlanRequirementInfo {
                id: "REQ-1".into(),
                text: "Retry remains safe".into(),
                kind: "constraint".into(),
                order_index: 0,
            }],
            steps: vec![TaskPlanStepInfo {
                id: "step-1".into(),
                order_index: 0,
                title: "Add retry guard".into(),
                description: "Reject duplicate work".into(),
                kind: "implementation".into(),
                complexity: 2,
                acceptance_criteria: vec!["Duplicate work is rejected".into()],
                expected_paths: vec!["src/retry.rs".into()],
                satisfies: vec!["REQ-1".into()],
            }],
        }
    }

    #[test]
    fn builds_a_bounded_context_with_an_explicit_grounding_contract() {
        let instruction =
            critique_instruction(&plan(), &[finding("GAP:REQ-1")]).expect("context serializes");
        assert!(instruction.contains("\"planVersion\":2"));
        assert!(instruction.contains("\"id\":\"GAP:REQ-1\""));
        assert!(instruction.contains("at most 3 issues"));
        assert!(instruction.contains("Every issue must cite at least one exact finding ID"));
        assert!(!instruction.contains("private-task-id"));
        assert!(!instruction.contains("private-artifact-id"));
        assert!(!instruction.contains("\"complexity\""));
        assert!(!instruction.contains("\"createdAt\""));
    }

    #[test]
    fn retains_only_grounded_complete_issues_and_caps_the_brief() {
        let response = r#"```json
        {"issues":[
          {"findingIds":["GAP:REQ-1"],"explanation":" First ","proposedRepair":" Add a step ",
           "repairs":[{"kind":"add_step","title":" Cover retry ","description":" Add coverage ",
             "complexity":2,"acceptanceCriteria":[" Pass "],"expectedPaths":[" tests/retry.rs "],
             "satisfies":["REQ-1"]}]},
          {"findingIds":["INVENTED"],"explanation":"Unsupported","proposedRepair":"Ignore",
           "repairs":[{"kind":"set_step_expected_paths","stepId":"step-1","expectedPaths":["src/**"]}]},
          {"findingIds":["MISSING_PATHS:step-1"],"explanation":"Second","proposedRepair":"Add paths",
           "repairs":[{"kind":"set_step_expected_paths","stepId":"step-1","expectedPaths":["src/**"]}]},
          {"findingIds":["GAP:REQ-1"],"explanation":"Third","proposedRepair":"Split step",
           "repairs":[{"kind":"set_step_requirements","stepId":"step-1","satisfies":["REQ-1"]}]},
          {"findingIds":["GAP:REQ-1"],"explanation":"Fourth","proposedRepair":"Never shown",
           "repairs":[{"kind":"set_step_requirements","stepId":"step-1","satisfies":["REQ-1"]}]}
        ]}
        ```"#;
        let issues = grounded_issues(
            response,
            &plan(),
            &[finding("GAP:REQ-1"), finding("MISSING_PATHS:step-1")],
        );
        assert_eq!(issues.len(), 3);
        assert_eq!(issues[0].explanation, "First");
        assert_eq!(issues[0].proposed_repair, "Add a step");
        assert_eq!(issues[1].finding_ids, ["MISSING_PATHS:step-1"]);
        assert!(matches!(
            issues[0].repairs[0],
            TaskPlanRepair::AddStep { .. }
        ));
    }

    #[test]
    fn rejects_malformed_or_entirely_unsupported_output() {
        assert!(grounded_issues("not json", &plan(), &[finding("GAP:REQ-1")]).is_empty());
        let unsupported = r#"{"issues":[{"findingIds":["FAKE"],"explanation":"Claim",
            "proposedRepair":"Repair","repairs":[{"kind":"set_step_expected_paths",
            "stepId":"invented","expectedPaths":["src/**"]}]}]}"#;
        assert!(grounded_issues(unsupported, &plan(), &[finding("GAP:REQ-1")]).is_empty());
    }

    #[test]
    fn applies_typed_repairs_to_a_new_draft_without_mutating_the_source() {
        let source = plan();
        let issues = vec![TaskPlanCritiqueIssue {
            finding_ids: vec!["GAP:REQ-1".into()],
            explanation: "Add focused coverage".into(),
            proposed_repair: "Add a step and narrow the original path.".into(),
            repairs: vec![
                TaskPlanRepair::SetStepExpectedPaths {
                    step_id: "step-1".into(),
                    expected_paths: vec!["src/retry/**".into()],
                },
                TaskPlanRepair::AddStep {
                    title: "Test retry guard".into(),
                    description: "Add regression coverage".into(),
                    complexity: 1,
                    acceptance_criteria: vec!["Focused tests pass".into()],
                    expected_paths: vec!["tests/retry.rs".into()],
                    satisfies: vec!["REQ-1".into()],
                },
            ],
        }];
        let repaired = repair_draft(&source, &issues).expect("repair applies");
        assert_eq!(source.steps.len(), 1);
        assert_eq!(source.steps[0].expected_paths, ["src/retry.rs"]);
        assert_eq!(repaired.steps.len(), 2);
        assert_eq!(repaired.steps[0].expected_paths, ["src/retry/**"]);
        assert_eq!(repaired.steps[1].title, "Test retry guard");
        assert_eq!(repaired.task_id, source.task_id);
        assert_eq!(repaired.source_artifact_id, source.source_artifact_id);
    }
}
