use serde::Serialize;

pub const TASK_COMPLEXITY_ASSESSMENT_VERSION: &str = "deterministic_v1";
pub const TASK_COMPLEXITY_PROFILES: [&str; 3] = ["quick", "standard", "complex"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskComplexityAssessment {
    pub profile: String,
    pub reasons: Vec<String>,
    pub confidence: i64,
    pub version: String,
}

pub fn assess_task_complexity(prompt: &str) -> TaskComplexityAssessment {
    let normalized = prompt.to_lowercase();
    let mut score = 0_i64;
    let mut reasons = Vec::new();

    let security = contains_any(
        &normalized,
        &[
            "auth",
            "authentication",
            "authorization",
            "login",
            "security",
            "payment",
            "plaćanje",
            "placanje",
        ],
    );
    if security {
        score += 5;
        reasons.push("security- or payment-sensitive scope".to_string());
    }

    let migration = contains_any(
        &normalized,
        &[
            "migration",
            "migracija",
            "schema change",
            "promena šeme",
            "promena seme",
            "data backfill",
        ],
    );
    if migration {
        score += 4;
        reasons.push("data migration or schema change".to_string());
    }

    let vertical = contains_any(
        &normalized,
        &[
            "new vertical",
            "nova vertikala",
            "novu vertikalu",
            "end-to-end",
            "end to end",
            "cela nova funkcionalnost",
            "whole workflow",
        ],
    );
    if vertical {
        score += 5;
        reasons.push("end-to-end or new-vertical scope".to_string());
    }

    let ui_layer = contains_any(
        &normalized,
        &[
            "ui",
            "frontend",
            "button",
            "dugme",
            "component",
            "komponenta",
            "screen",
            "ekran",
        ],
    );
    let backend_layer = contains_any(
        &normalized,
        &["backend", "api", "endpoint", "service", "servis", "handler"],
    );
    let data_layer = contains_any(
        &normalized,
        &[
            "database",
            "db",
            "sqlite",
            "schema",
            "persistence",
            "baza",
            "storage",
        ],
    );
    let layers = [ui_layer, backend_layer, data_layer]
        .into_iter()
        .filter(|matched| *matched)
        .count();
    if layers >= 3 {
        score += 5;
        reasons.push("cross-layer scope across UI, backend, and data".to_string());
    } else if layers == 2 {
        score += 3;
        reasons.push("cross-layer scope".to_string());
    }

    if contains_any(
        &normalized,
        &[
            "multiple modules",
            "više modula",
            "vise modula",
            "across modules",
            "cross-cutting",
        ],
    ) {
        score += 2;
        reasons.push("cross-cutting module impact".to_string());
    }
    if prompt.chars().count() > 600 {
        score += 2;
        reasons.push("large prompt with potentially broad acceptance scope".to_string());
    }

    let simple_cue = contains_any(
        &normalized,
        &[
            "button",
            "dugme",
            "label",
            "tekst",
            "text",
            "copy",
            "typo",
            "boja",
            "color",
            "rename",
            "preimenuj",
        ],
    );

    let (profile, confidence) = if score >= 4 {
        ("complex", (75 + score * 2).min(95))
    } else if score == 0 && simple_cue && !backend_layer && !data_layer {
        reasons.push("bounded single-surface change".to_string());
        ("quick", 82)
    } else {
        if reasons.is_empty() {
            reasons.push("prompt alone does not prove a bounded or high-risk scope".to_string());
        }
        ("standard", if score == 0 { 55 } else { 65 })
    };

    TaskComplexityAssessment {
        profile: profile.to_string(),
        reasons,
        confidence,
        version: TASK_COMPLEXITY_ASSESSMENT_VERSION.to_string(),
    }
}

pub fn is_task_complexity_profile(profile: &str) -> bool {
    TASK_COMPLEXITY_PROFILES.contains(&profile)
}

fn contains_any(text: &str, terms: &[&str]) -> bool {
    terms.iter().any(|term| {
        if term.contains([' ', '-']) {
            text.contains(term)
        } else {
            text.split(|character: char| !character.is_alphanumeric())
                .any(|token| token == *term)
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_bounded_ui_work_as_quick() {
        let assessment = assess_task_complexity("Dodaj dugme koje otvara postojeći modal");
        assert_eq!(assessment.profile, "quick");
        assert_eq!(assessment.reasons, vec!["bounded single-surface change"]);
        assert!((0..=100).contains(&assessment.confidence));
    }

    #[test]
    fn defaults_ambiguous_work_to_standard() {
        let assessment = assess_task_complexity("Poboljšaj obradu grešaka");
        assert_eq!(assessment.profile, "standard");
        assert_eq!(
            assessment.reasons,
            vec!["prompt alone does not prove a bounded or high-risk scope"]
        );

        let two_layer = assess_task_complexity("Add a UI form and one API endpoint");
        assert_eq!(two_layer.profile, "standard");
        assert_eq!(two_layer.reasons, vec!["cross-layer scope"]);

        let data_change = assess_task_complexity("Rename a database column");
        assert_eq!(data_change.profile, "standard");
    }

    #[test]
    fn classifies_sensitive_and_cross_layer_work_as_complex() {
        let sensitive = assess_task_complexity("Add login to the app");
        assert_eq!(sensitive.profile, "complex");
        assert_eq!(
            sensitive.reasons,
            vec!["security- or payment-sensitive scope"]
        );

        let vertical =
            assess_task_complexity("Dodaj novu vertikalu kroz frontend, backend API i SQLite bazu");
        assert_eq!(vertical.profile, "complex");
        assert_eq!(
            vertical.reasons,
            vec![
                "end-to-end or new-vertical scope",
                "cross-layer scope across UI, backend, and data"
            ]
        );
    }

    #[test]
    fn assessment_is_case_insensitive_stable_and_versioned() {
        let first = assess_task_complexity("DATABASE MIGRATION across UI and API");
        let second = assess_task_complexity("database migration across ui and api");
        assert_eq!(first, second);
        assert_eq!(first.version, TASK_COMPLEXITY_ASSESSMENT_VERSION);
        assert!((0..=100).contains(&first.confidence));
        assert!(TASK_COMPLEXITY_PROFILES
            .iter()
            .all(|profile| is_task_complexity_profile(profile)));
        assert!(!is_task_complexity_profile("tiny"));
    }
}
