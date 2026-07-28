use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::task_plan::TaskPlanFindingInfo;

const MAX_PRIMARY_ISSUES: usize = 3;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanCritiqueIssue {
    pub finding_ids: Vec<String>,
    pub explanation: String,
    pub proposed_repair: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CritiqueEnvelope {
    issues: Vec<TaskPlanCritiqueIssue>,
}

pub fn grounded_issues(
    response: &str,
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
            (!issue.finding_ids.is_empty()
                && !issue.explanation.is_empty()
                && !issue.proposed_repair.is_empty())
            .then_some(issue)
        })
        .take(MAX_PRIMARY_ISSUES)
        .collect()
}

fn json_object(response: &str) -> Option<&str> {
    let start = response.find('{')?;
    let end = response.rfind('}')?;
    (start <= end).then_some(&response[start..=end])
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn retains_only_grounded_complete_issues_and_caps_the_brief() {
        let response = r#"```json
        {"issues":[
          {"findingIds":["GAP:REQ-1"],"explanation":" First ","proposedRepair":" Add a step "},
          {"findingIds":["INVENTED"],"explanation":"Unsupported","proposedRepair":"Ignore"},
          {"findingIds":["MISSING_PATHS:step-1"],"explanation":"Second","proposedRepair":"Add paths"},
          {"findingIds":["GAP:REQ-1"],"explanation":"Third","proposedRepair":"Split step"},
          {"findingIds":["GAP:REQ-1"],"explanation":"Fourth","proposedRepair":"Never shown"}
        ]}
        ```"#;
        let issues = grounded_issues(
            response,
            &[finding("GAP:REQ-1"), finding("MISSING_PATHS:step-1")],
        );
        assert_eq!(issues.len(), 3);
        assert_eq!(issues[0].explanation, "First");
        assert_eq!(issues[0].proposed_repair, "Add a step");
        assert_eq!(issues[1].finding_ids, ["MISSING_PATHS:step-1"]);
    }

    #[test]
    fn rejects_malformed_or_entirely_unsupported_output() {
        assert!(grounded_issues("not json", &[finding("GAP:REQ-1")]).is_empty());
        let unsupported = r#"{"issues":[{"findingIds":["FAKE"],"explanation":"Claim",
            "proposedRepair":"Repair"}]}"#;
        assert!(grounded_issues(unsupported, &[finding("GAP:REQ-1")]).is_empty());
    }
}
