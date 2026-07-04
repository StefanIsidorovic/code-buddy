use crate::{
    adapters::AdapterRegistry, secrets::SecretStore, session::SessionManager, storage::ConfigStore,
};
use std::sync::Arc;

pub struct AppState {
    pub storage: Arc<ConfigStore>,
    pub secrets: Arc<SecretStore>,
    pub adapters: AdapterRegistry,
    pub sessions: SessionManager,
}

impl AppState {
    pub fn new(storage: ConfigStore) -> Self {
        Self {
            storage: Arc::new(storage),
            secrets: Arc::new(SecretStore::keyring()),
            adapters: AdapterRegistry::production(),
            sessions: SessionManager::new(),
        }
    }
}
