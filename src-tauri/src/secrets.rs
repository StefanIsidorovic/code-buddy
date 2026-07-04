use crate::{
    domain::AgentId,
    errors::{AppError, AppResult},
};
#[cfg(test)]
use std::{collections::HashMap, sync::Mutex};

const SERVICE_NAME: &str = "code-buddy";
const REDACTED: &str = "[redacted]";

pub trait SecretBackend: Send + Sync {
    fn set(&self, account: &str, value: &str) -> AppResult<()>;
    fn get(&self, account: &str) -> AppResult<Option<String>>;
    fn delete(&self, account: &str) -> AppResult<()>;
}

pub struct KeyringBackend;

impl SecretBackend for KeyringBackend {
    fn set(&self, account: &str, value: &str) -> AppResult<()> {
        let entry = keyring::Entry::new(SERVICE_NAME, account)?;
        entry.set_password(value)?;
        Ok(())
    }

    fn get(&self, account: &str) -> AppResult<Option<String>> {
        let entry = keyring::Entry::new(SERVICE_NAME, account)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(err) => Err(AppError::from(err)),
        }
    }

    fn delete(&self, account: &str) -> AppResult<()> {
        let entry = keyring::Entry::new(SERVICE_NAME, account)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(AppError::from(err)),
        }
    }
}

pub struct SecretStore<B: SecretBackend = KeyringBackend> {
    backend: B,
}

impl SecretStore<KeyringBackend> {
    pub fn keyring() -> Self {
        Self {
            backend: KeyringBackend,
        }
    }
}

impl<B: SecretBackend> SecretStore<B> {
    pub fn new(backend: B) -> Self {
        Self { backend }
    }

    pub fn set_secret(&self, agent_id: AgentId, value: &str) -> AppResult<()> {
        if value.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "secret must not be empty".to_string(),
            ));
        }
        self.backend.set(&account(agent_id), value)
    }

    pub fn has_secret(&self, agent_id: AgentId) -> AppResult<bool> {
        Ok(self.backend.get(&account(agent_id))?.is_some())
    }

    pub fn get_secret(&self, agent_id: AgentId) -> AppResult<Option<String>> {
        self.backend.get(&account(agent_id))
    }

    pub fn delete_secret(&self, agent_id: AgentId) -> AppResult<()> {
        self.backend.delete(&account(agent_id))
    }
}

pub fn redact_secret(input: &str, secrets: &[String]) -> String {
    secrets
        .iter()
        .filter(|secret| !secret.is_empty())
        .fold(input.to_string(), |redacted, secret| {
            redacted.replace(secret, REDACTED)
        })
}

fn account(agent_id: AgentId) -> String {
    format!("agent:{}", agent_id)
}

#[cfg(test)]
#[derive(Default)]
pub struct MemorySecretBackend {
    values: Mutex<HashMap<String, String>>,
}

#[cfg(test)]
impl SecretBackend for MemorySecretBackend {
    fn set(&self, account: &str, value: &str) -> AppResult<()> {
        self.values
            .lock()
            .expect("memory secret lock")
            .insert(account.to_string(), value.to_string());
        Ok(())
    }

    fn get(&self, account: &str) -> AppResult<Option<String>> {
        Ok(self
            .values
            .lock()
            .expect("memory secret lock")
            .get(account)
            .cloned())
    }

    fn delete(&self, account: &str) -> AppResult<()> {
        self.values
            .lock()
            .expect("memory secret lock")
            .remove(account);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stores_checks_and_deletes_secret() {
        let store = SecretStore::new(MemorySecretBackend::default());

        assert!(!store.has_secret(AgentId::Codex).expect("check"));
        store
            .set_secret(AgentId::Codex, "sk-test")
            .expect("set secret");
        assert!(store.has_secret(AgentId::Codex).expect("check"));
        assert_eq!(
            store.get_secret(AgentId::Codex).expect("get"),
            Some("sk-test".to_string())
        );
        store.delete_secret(AgentId::Codex).expect("delete");
        assert!(!store.has_secret(AgentId::Codex).expect("check"));
    }

    #[test]
    fn rejects_empty_secret() {
        let store = SecretStore::new(MemorySecretBackend::default());
        let err = store
            .set_secret(AgentId::Kimi, " ")
            .expect_err("empty secret rejected");

        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn redacts_multiple_secret_values() {
        let redacted = redact_secret(
            "OPENAI_API_KEY=VALUE_OPENAI MOONSHOT_API_KEY=VALUE_KIMI",
            &["VALUE_OPENAI".to_string(), "VALUE_KIMI".to_string()],
        );

        assert_eq!(
            redacted,
            "OPENAI_API_KEY=[redacted] MOONSHOT_API_KEY=[redacted]"
        );
    }
}
