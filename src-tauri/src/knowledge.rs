use crate::{
    errors::{AppError, AppResult},
    storage::{KnowledgeItemInfo, KnowledgeUnitInfo, TaskPhaseArtifactInfo},
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedTaskContextSelectionRequest {
    pub project_id: String,
    pub initialization_id: String,
    pub task: String,
    pub repository_id: Option<String>,
    #[serde(default)]
    pub paths: Vec<String>,
    pub character_budget: Option<usize>,
    pub transcript_session_id: Option<String>,
    pub task_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedTaskContextSourceInfo {
    pub id: String,
    pub source_type: String,
    pub kind: String,
    pub title: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedTaskContextSelectionEntryInfo {
    pub source: UnifiedTaskContextSourceInfo,
    pub score: i64,
    pub reason: String,
    pub character_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedTaskContextSelectionInfo {
    pub initialization_id: String,
    pub character_budget: usize,
    pub used_characters: usize,
    pub remaining_characters: usize,
    pub rendered_context: String,
    pub included: Vec<UnifiedTaskContextSelectionEntryInfo>,
    pub excluded: Vec<UnifiedTaskContextSelectionEntryInfo>,
}

pub fn select_unified_task_context(
    request: UnifiedTaskContextSelectionRequest,
    units: Vec<KnowledgeUnitInfo>,
    cards: Vec<KnowledgeItemInfo>,
    artifacts: Vec<TaskPhaseArtifactInfo>,
) -> AppResult<UnifiedTaskContextSelectionInfo> {
    let base = select_task_context(
        TaskContextSelectionRequest {
            initialization_id: request.initialization_id,
            task: request.task,
            repository_id: request.repository_id,
            paths: request.paths,
            character_budget: request.character_budget,
        },
        units,
    )?;
    let mut candidates = base
        .included
        .into_iter()
        .map(|entry| unified_entry(unit_source(entry.unit), entry.score, &entry.reason))
        .collect::<Vec<_>>();
    let mut excluded = Vec::new();
    for entry in base.excluded {
        if entry.reason == "budget_exceeded" {
            candidates.push(unified_entry(
                unit_source(entry.unit),
                entry.score,
                "ranked_project_knowledge",
            ));
        } else {
            excluded.push(unified_entry(
                unit_source(entry.unit),
                entry.score,
                &entry.reason,
            ));
        }
    }
    candidates.extend(cards.into_iter().map(|card| {
        unified_entry(
            UnifiedTaskContextSourceInfo {
                id: card.id,
                source_type: "knowledge_card".into(),
                kind: card.kind,
                title: card.title,
                content: card.body,
            },
            2_000,
            "explicit_attachment",
        )
    }));
    candidates.extend(artifacts.into_iter().enumerate().map(|(index, artifact)| {
        unified_entry(
            UnifiedTaskContextSourceInfo {
                id: artifact.id,
                source_type: "task_artifact".into(),
                kind: artifact.kind,
                title: format!("{} phase", artifact.phase),
                content: artifact.content,
            },
            1_500 - i64::try_from(index).unwrap_or(i64::MAX),
            "task_phase_artifact",
        )
    }));
    candidates.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.source.source_type.cmp(&right.source.source_type))
            .then_with(|| left.source.id.cmp(&right.source.id))
    });
    let mut included = Vec::new();
    let mut rendered = Vec::new();
    let mut used = 0;
    for mut entry in candidates {
        let block = format!(
            "- [{} / {} / {}] {}",
            entry.source.source_type, entry.source.kind, entry.source.title, entry.source.content
        );
        let size = block.chars().count() + usize::from(!rendered.is_empty());
        entry.character_count = size;
        if used + size > base.character_budget {
            entry.reason = "budget_exceeded".into();
            excluded.push(entry);
        } else {
            used += size;
            rendered.push(block);
            included.push(entry);
        }
    }
    excluded.sort_by(|left, right| left.source.id.cmp(&right.source.id));
    Ok(UnifiedTaskContextSelectionInfo {
        initialization_id: base.initialization_id,
        character_budget: base.character_budget,
        used_characters: used,
        remaining_characters: base.character_budget - used,
        rendered_context: rendered.join("\n"),
        included,
        excluded,
    })
}

fn unit_source(unit: KnowledgeUnitInfo) -> UnifiedTaskContextSourceInfo {
    UnifiedTaskContextSourceInfo {
        id: unit.id,
        source_type: "project_knowledge".into(),
        kind: unit.kind,
        title: unit.topic,
        content: unit.content,
    }
}

fn unified_entry(
    source: UnifiedTaskContextSourceInfo,
    score: i64,
    reason: &str,
) -> UnifiedTaskContextSelectionEntryInfo {
    UnifiedTaskContextSelectionEntryInfo {
        source,
        score,
        reason: reason.into(),
        character_count: 0,
    }
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

    #[test]
    fn unifies_explicit_cards_artifacts_and_ranked_project_knowledge_under_one_budget() {
        let card = KnowledgeItemInfo {
            id: "card".into(),
            project_id: Some("project-1".into()),
            title: "Manual rule".into(),
            body: "Keep the public API stable".into(),
            kind: "decision".into(),
            scope: "project".into(),
            source_transcript_session_id: None,
            created_at: 1,
            updated_at: 1,
        };
        let artifact = TaskPhaseArtifactInfo {
            id: "artifact".into(),
            task_id: "task-1".into(),
            phase: "analysis".into(),
            sequence: 0,
            kind: "finding".into(),
            content: "The parser owns validation".into(),
            source_transcript_event_ids: vec!["event".into()],
            created_at: 1,
        };
        let request = UnifiedTaskContextSelectionRequest {
            project_id: "project-1".into(),
            initialization_id: "init-1".into(),
            task: "update parser".into(),
            repository_id: None,
            paths: vec![],
            character_budget: Some(1_000),
            transcript_session_id: Some("session".into()),
            task_id: Some("task-1".into()),
        };
        let result = select_unified_task_context(
            request,
            vec![unit("unit", "purpose", "parser module")],
            vec![card],
            vec![artifact],
        )
        .expect("unified selection succeeds");

        assert_eq!(
            result
                .included
                .iter()
                .map(|entry| entry.source.source_type.as_str())
                .collect::<Vec<_>>(),
            vec!["knowledge_card", "task_artifact", "project_knowledge"]
        );
        assert_eq!(
            result.used_characters + result.remaining_characters,
            result.character_budget
        );
        assert!(result.rendered_context.contains("Manual rule"));
    }
}
