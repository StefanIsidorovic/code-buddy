use crate::adapters::CapabilityStatus;
use serde::{Deserialize, Serialize};

pub const MODEL_CATALOG_SCHEMA_VERSION: i64 = 1;
pub const PROJECT_KNOWLEDGE_SCHEMA_VERSION: i64 = 1;

pub const DEFAULT_SYNTHESIS_MODEL_PROFILE_ID: &str = "openai-gpt-5.6-terra-medium";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelTier {
    Fast,
    Mid,
    High,
    Max,
}

impl ModelTier {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fast => "fast",
            Self::Mid => "mid",
            Self::High => "high",
            Self::Max => "max",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelProfileStatus {
    Selectable,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProviderInfo {
    pub id: String,
    pub display_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelParameterInfo {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCapabilityInfo {
    pub structured_output: CapabilityStatus,
    pub reasoning_control: CapabilityStatus,
    pub background_mode: CapabilityStatus,
    pub api: CapabilityStatus,
    pub cli: CapabilityStatus,
    pub acp: CapabilityStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProfileInfo {
    pub id: String,
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    pub tier: ModelTier,
    pub parameters: Vec<ModelParameterInfo>,
    pub capabilities: ModelCapabilityInfo,
    pub status: ModelProfileStatus,
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCatalogInfo {
    pub schema_version: i64,
    pub providers: Vec<ModelProviderInfo>,
    pub profiles: Vec<ModelProfileInfo>,
}

pub fn model_catalog() -> ModelCatalogInfo {
    ModelCatalogInfo {
        schema_version: MODEL_CATALOG_SCHEMA_VERSION,
        providers: vec![
            provider("openai", "OpenAI"),
            provider("anthropic", "Anthropic"),
            provider("moonshot", "Moonshot AI"),
        ],
        profiles: vec![
            profile(
                "openai-gpt-5.6-luna-low",
                "openai",
                "gpt-5.6-luna",
                "GPT-5.6 Luna",
                ModelTier::Fast,
                &[("reasoning.effort", "low")],
                openai_capabilities(),
            ),
            profile(
                DEFAULT_SYNTHESIS_MODEL_PROFILE_ID,
                "openai",
                "gpt-5.6-terra",
                "GPT-5.6 Terra",
                ModelTier::Mid,
                &[("reasoning.effort", "medium")],
                openai_capabilities(),
            ),
            profile(
                "openai-gpt-5.6-sol-high",
                "openai",
                "gpt-5.6-sol",
                "GPT-5.6 Sol",
                ModelTier::High,
                &[("reasoning.effort", "high")],
                openai_capabilities(),
            ),
            profile(
                "openai-gpt-5.6-sol-max",
                "openai",
                "gpt-5.6-sol",
                "GPT-5.6 Sol Max",
                ModelTier::Max,
                &[("reasoning.effort", "max")],
                openai_capabilities(),
            ),
            profile(
                "anthropic-claude-haiku-4.5-fast",
                "anthropic",
                "claude-haiku-4-5-20251001",
                "Claude Haiku 4.5",
                ModelTier::Fast,
                &[],
                anthropic_capabilities(CapabilityStatus::Unknown),
            ),
            profile(
                "anthropic-claude-sonnet-5-mid",
                "anthropic",
                "claude-sonnet-5",
                "Claude Sonnet 5",
                ModelTier::Mid,
                &[("thinking", "adaptive")],
                anthropic_capabilities(CapabilityStatus::Supported),
            ),
            profile(
                "anthropic-claude-opus-4.8-high",
                "anthropic",
                "claude-opus-4-8",
                "Claude Opus 4.8",
                ModelTier::High,
                &[("thinking", "adaptive")],
                anthropic_capabilities(CapabilityStatus::Supported),
            ),
            profile(
                "anthropic-claude-fable-5-max",
                "anthropic",
                "claude-fable-5",
                "Claude Fable 5",
                ModelTier::Max,
                &[("thinking", "adaptive")],
                anthropic_capabilities(CapabilityStatus::Supported),
            ),
            profile(
                "moonshot-kimi-k2.6-mid",
                "moonshot",
                "kimi-k2.6",
                "Kimi K2.6",
                ModelTier::Mid,
                &[("thinking", "disabled")],
                kimi_capabilities(),
            ),
            profile(
                "moonshot-kimi-k2.6-high",
                "moonshot",
                "kimi-k2.6",
                "Kimi K2.6 Thinking",
                ModelTier::High,
                &[("thinking", "enabled")],
                kimi_capabilities(),
            ),
        ],
    }
}

pub fn synthesis_model_catalog(
    provider_availability: &std::collections::HashMap<String, Result<(), String>>,
) -> ModelCatalogInfo {
    let mut catalog = model_catalog();
    for profile in &mut catalog.profiles {
        let unavailable_reason = match provider_availability.get(&profile.provider_id) {
            Some(Ok(())) => None,
            Some(Err(reason)) => Some(reason.clone()),
            None => Some(format!(
                "{} synthesis adapter is not implemented yet",
                profile.provider_id
            )),
        };
        if let Some(reason) = unavailable_reason {
            profile.status = ModelProfileStatus::Unavailable;
            profile.unavailable_reason = Some(reason);
        }
    }
    catalog
}

pub fn model_profile(profile_id: &str) -> Option<ModelProfileInfo> {
    let profile_id = profile_id.trim();
    model_catalog()
        .profiles
        .into_iter()
        .find(|profile| profile.id == profile_id)
}

fn provider(id: &str, display_name: &str) -> ModelProviderInfo {
    ModelProviderInfo {
        id: id.to_string(),
        display_name: display_name.to_string(),
    }
}

fn profile(
    id: &str,
    provider_id: &str,
    model_id: &str,
    display_name: &str,
    tier: ModelTier,
    parameters: &[(&str, &str)],
    capabilities: ModelCapabilityInfo,
) -> ModelProfileInfo {
    ModelProfileInfo {
        id: id.to_string(),
        provider_id: provider_id.to_string(),
        model_id: model_id.to_string(),
        display_name: display_name.to_string(),
        tier,
        parameters: parameters
            .iter()
            .map(|(name, value)| ModelParameterInfo {
                name: (*name).to_string(),
                value: (*value).to_string(),
            })
            .collect(),
        capabilities,
        status: ModelProfileStatus::Selectable,
        unavailable_reason: None,
    }
}

fn openai_capabilities() -> ModelCapabilityInfo {
    ModelCapabilityInfo {
        structured_output: CapabilityStatus::Supported,
        reasoning_control: CapabilityStatus::Supported,
        background_mode: CapabilityStatus::Supported,
        api: CapabilityStatus::Supported,
        cli: CapabilityStatus::Unknown,
        acp: CapabilityStatus::Unknown,
    }
}

fn anthropic_capabilities(reasoning_control: CapabilityStatus) -> ModelCapabilityInfo {
    ModelCapabilityInfo {
        structured_output: CapabilityStatus::Supported,
        reasoning_control,
        background_mode: CapabilityStatus::Unknown,
        api: CapabilityStatus::Supported,
        cli: CapabilityStatus::Unknown,
        acp: CapabilityStatus::Unknown,
    }
}

fn kimi_capabilities() -> ModelCapabilityInfo {
    ModelCapabilityInfo {
        structured_output: CapabilityStatus::Supported,
        reasoning_control: CapabilityStatus::Supported,
        background_mode: CapabilityStatus::Unknown,
        api: CapabilityStatus::Supported,
        cli: CapabilityStatus::Unknown,
        acp: CapabilityStatus::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn catalog_has_unique_profiles_and_known_providers() {
        let catalog = model_catalog();
        let provider_ids = catalog
            .providers
            .iter()
            .map(|provider| provider.id.as_str())
            .collect::<HashSet<_>>();
        let profile_ids = catalog
            .profiles
            .iter()
            .map(|profile| profile.id.as_str())
            .collect::<HashSet<_>>();

        assert_eq!(catalog.schema_version, MODEL_CATALOG_SCHEMA_VERSION);
        assert_eq!(profile_ids.len(), catalog.profiles.len());
        assert!(catalog
            .profiles
            .iter()
            .all(|profile| provider_ids.contains(profile.provider_id.as_str())));
        assert!(catalog
            .profiles
            .iter()
            .all(|profile| profile.status == ModelProfileStatus::Selectable));
    }

    #[test]
    fn catalog_covers_every_app_tier() {
        let catalog = model_catalog();

        for tier in [
            ModelTier::Fast,
            ModelTier::Mid,
            ModelTier::High,
            ModelTier::Max,
        ] {
            assert!(catalog.profiles.iter().any(|profile| profile.tier == tier));
        }
    }

    #[test]
    fn synthesis_catalog_reflects_provider_runtime_availability() {
        let without_key = synthesis_model_catalog(&std::collections::HashMap::from([(
            "openai".to_string(),
            Err("Set OPENAI_API_KEY before starting the app".to_string()),
        )]));
        assert!(without_key.profiles.iter().all(|profile| {
            profile.status == ModelProfileStatus::Unavailable
                && profile.unavailable_reason.is_some()
        }));

        let with_key = synthesis_model_catalog(&std::collections::HashMap::from([(
            "openai".to_string(),
            Ok(()),
        )]));
        assert!(with_key.profiles.iter().all(|profile| {
            if profile.provider_id == "openai" {
                profile.status == ModelProfileStatus::Selectable
                    && profile.unavailable_reason.is_none()
            } else {
                profile.status == ModelProfileStatus::Unavailable
                    && profile.unavailable_reason.is_some()
            }
        }));
    }

    #[test]
    fn profile_lookup_trims_input_and_rejects_unknown_ids() {
        let profile = model_profile("  openai-gpt-5.6-sol-high  ").expect("known profile resolves");

        assert_eq!(profile.provider_id, "openai");
        assert_eq!(profile.model_id, "gpt-5.6-sol");
        assert_eq!(profile.tier, ModelTier::High);
        assert!(model_profile("unknown-profile").is_none());
    }
}
