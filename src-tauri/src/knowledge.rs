use crate::{
    errors::{AppError, AppResult},
    storage::KnowledgeUnitInfo,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const DEFAULT_TASK_CONTEXT_CHARACTER_BUDGET: usize = 6_000;
const MAX_TASK_CONTEXT_CHARACTER_BUDGET: usize = 50_000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContextSelectionRequest {
    pub initialization_id: String,
    pub task: String,
    pub repository_id: Option<String>,
    #[serde(default)]
    pub paths: Vec<String>,
    pub character_budget: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContextSelectionEntryInfo {
    pub unit: KnowledgeUnitInfo,
    pub score: i64,
    pub reason: String,
    pub character_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContextSelectionInfo {
    pub initialization_id: String,
    pub character_budget: usize,
    pub used_characters: usize,
    pub remaining_characters: usize,
    pub rendered_context: String,
    pub included: Vec<TaskContextSelectionEntryInfo>,
    pub excluded: Vec<TaskContextSelectionEntryInfo>,
}

pub fn select_task_context(
    request: TaskContextSelectionRequest,
    units: Vec<KnowledgeUnitInfo>,
) -> AppResult<TaskContextSelectionInfo> {
    let initialization_id = request.initialization_id.trim();
    if initialization_id.is_empty() {
        return Err(AppError::InvalidInput(
            "initialization id must not be empty".to_string(),
        ));
    }
    let task = request.task.trim();
    if task.is_empty() {
        return Err(AppError::InvalidInput(
            "task context selection requires a non-empty task".to_string(),
        ));
    }
    let character_budget = request
        .character_budget
        .unwrap_or(DEFAULT_TASK_CONTEXT_CHARACTER_BUDGET);
    if character_budget == 0 || character_budget > MAX_TASK_CONTEXT_CHARACTER_BUDGET {
        return Err(AppError::InvalidInput(format!(
            "task context character budget must be between 1 and {MAX_TASK_CONTEXT_CHARACTER_BUDGET}"
        )));
    }

    let task_tokens = normalized_tokens(task);
    let requested_paths = request
        .paths
        .iter()
        .map(|path| path.trim().to_ascii_lowercase())
        .filter(|path| !path.is_empty())
        .collect::<Vec<_>>();
    let repository_id = request
        .repository_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let mut candidates = Vec::new();
    let mut excluded = Vec::new();

    for unit in units {
        if unit.status != "active" {
            excluded.push(selection_entry(unit, 0, "uncertain_status"));
            continue;
        }
        let mandatory = matches!(unit.kind.as_str(), "constraint" | "agent_rule");
        let repository_match = repository_id.is_some_and(|repository_id| {
            unit.sources
                .iter()
                .any(|source| source.repository_id.as_deref() == Some(repository_id))
        });
        let path_match = !requested_paths.is_empty()
            && unit.sources.iter().any(|source| {
                let source_values = [source.path.as_deref(), Some(source.source_key.as_str())];
                requested_paths.iter().any(|requested_path| {
                    source_values.iter().flatten().any(|source_value| {
                        let source_value = source_value.to_ascii_lowercase();
                        source_value.contains(requested_path)
                            || requested_path.contains(&source_value)
                    })
                })
            });
        let searchable = format!(
            "{} {} {} {}",
            unit.kind,
            unit.topic,
            unit.content,
            unit.sources
                .iter()
                .map(|source| source.source_key.as_str())
                .collect::<Vec<_>>()
                .join(" ")
        );
        let searchable_tokens = normalized_tokens(&searchable);
        let lexical_matches = task_tokens.intersection(&searchable_tokens).count() as i64;
        let score = i64::from(mandatory) * 1_000
            + i64::from(repository_match) * 300
            + i64::from(path_match) * 200
            + lexical_matches * 10;
        let reason = if mandatory {
            "mandatory_kind"
        } else if repository_match {
            "repository_match"
        } else if path_match {
            "path_match"
        } else if lexical_matches > 0 {
            "lexical_match"
        } else {
            excluded.push(selection_entry(unit, score, "not_relevant"));
            continue;
        };
        candidates.push(selection_entry(unit, score, reason));
    }

    candidates.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.unit.kind.cmp(&right.unit.kind))
            .then_with(|| left.unit.id.cmp(&right.unit.id))
    });

    let mut included = Vec::new();
    let mut rendered_blocks = Vec::new();
    let mut used_characters = 0;
    for mut candidate in candidates {
        let block = render_unit(&candidate.unit);
        let separator_characters = usize::from(!rendered_blocks.is_empty());
        let added_characters = block.chars().count() + separator_characters;
        candidate.character_count = added_characters;
        if used_characters + added_characters > character_budget {
            candidate.reason = "budget_exceeded".to_string();
            excluded.push(candidate);
            continue;
        }
        used_characters += added_characters;
        rendered_blocks.push(block);
        included.push(candidate);
    }
    excluded.sort_by(|left, right| left.unit.id.cmp(&right.unit.id));

    Ok(TaskContextSelectionInfo {
        initialization_id: initialization_id.to_string(),
        character_budget,
        used_characters,
        remaining_characters: character_budget - used_characters,
        rendered_context: rendered_blocks.join("\n"),
        included,
        excluded,
    })
}

fn selection_entry(
    unit: KnowledgeUnitInfo,
    score: i64,
    reason: &str,
) -> TaskContextSelectionEntryInfo {
    TaskContextSelectionEntryInfo {
        unit,
        score,
        reason: reason.to_string(),
        character_count: 0,
    }
}

fn normalized_tokens(value: &str) -> HashSet<String> {
    value
        .split(|character: char| !character.is_alphanumeric())
        .map(str::to_ascii_lowercase)
        .filter(|token| token.len() >= 2)
        .collect()
}

fn render_unit(unit: &KnowledgeUnitInfo) -> String {
    let sources = unit
        .sources
        .iter()
        .map(|source| source.source_key.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    if sources.is_empty() {
        format!("- [{} / {}] {}", unit.kind, unit.topic, unit.content)
    } else {
        format!(
            "- [{} / {}] {} [sources: {}]",
            unit.kind, unit.topic, unit.content, sources
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::KnowledgeUnitSourceInfo;

    fn unit(id: &str, kind: &str, content: &str) -> KnowledgeUnitInfo {
        KnowledgeUnitInfo {
            id: id.to_string(),
            project_id: "project-1".to_string(),
            initialization_id: "init-1".to_string(),
            derived_from_summary_id: "summary-1".to_string(),
            kind: kind.to_string(),
            topic: kind.to_string(),
            content: content.to_string(),
            scope: "project".to_string(),
            status: "active".to_string(),
            confidence: 100,
            schema_version: 1,
            sources: vec![KnowledgeUnitSourceInfo {
                source_key: "README.md#rules".to_string(),
                repository_id: None,
                path: None,
            }],
            created_at: 1,
        }
    }

    fn request(task: &str, character_budget: usize) -> TaskContextSelectionRequest {
        TaskContextSelectionRequest {
            initialization_id: "init-1".to_string(),
            task: task.to_string(),
            repository_id: None,
            paths: vec![],
            character_budget: Some(character_budget),
        }
    }

    #[test]
    fn prioritizes_mandatory_units_and_excludes_uncertainty() {
        let mut uncertain = unit("uncertain", "command", "Run cargo test");
        uncertain.status = "needs_confirmation".to_string();
        let result = select_task_context(
            request("update authentication", 1_000),
            vec![
                unit("fact", "purpose", "Authentication service"),
                unit("rule", "agent_rule", "Ask before schema changes"),
                uncertain,
            ],
        )
        .expect("selection succeeds");

        assert_eq!(result.included[0].unit.id, "rule");
        assert_eq!(result.included[0].reason, "mandatory_kind");
        assert!(result
            .excluded
            .iter()
            .any(|entry| entry.unit.id == "uncertain" && entry.reason == "uncertain_status"));
    }

    #[test]
    fn uses_repository_path_and_lexical_matches() {
        let mut path_unit = unit("path", "command", "Run frontend tests");
        path_unit.sources[0].repository_id = Some("repo-1".to_string());
        path_unit.sources[0].path = Some("src/App.tsx".to_string());
        let mut selection_request = request("change unrelated copy", 1_000);
        selection_request.repository_id = Some("repo-1".to_string());
        selection_request.paths = vec!["src/App.tsx".to_string()];

        let result =
            select_task_context(selection_request, vec![path_unit]).expect("selection succeeds");
        assert_eq!(result.included[0].reason, "repository_match");
        assert_eq!(result.included[0].score, 500);
    }

    #[test]
    fn enforces_exact_budget_and_stable_ties() {
        let first = unit("a", "purpose", "alpha task");
        let second = unit("b", "purpose", "alpha task");
        let first_block = render_unit(&first);
        let budget = first_block.chars().count();
        let result = select_task_context(request("alpha", budget), vec![second, first])
            .expect("selection succeeds");

        assert_eq!(result.used_characters, budget);
        assert_eq!(result.remaining_characters, 0);
        assert_eq!(result.included[0].unit.id, "a");
        assert!(result
            .excluded
            .iter()
            .any(|entry| entry.unit.id == "b" && entry.reason == "budget_exceeded"));
    }

    #[test]
    fn rejects_invalid_requests_and_excludes_no_match() {
        assert!(matches!(
            select_task_context(request(" ", 100), vec![]),
            Err(AppError::InvalidInput(_))
        ));
        assert!(matches!(
            select_task_context(request("task", 0), vec![]),
            Err(AppError::InvalidInput(_))
        ));
        let result = select_task_context(
            request("authentication", 100),
            vec![unit("other", "purpose", "render charts")],
        )
        .expect("selection succeeds");
        assert!(result.included.is_empty());
        assert_eq!(result.excluded[0].reason, "not_relevant");
    }
}
