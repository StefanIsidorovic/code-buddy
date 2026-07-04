use crate::{adapters::AdapterRegistry, secrets::SecretStore, storage::ConfigStore};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub storage: Arc<ConfigStore>,
    pub secrets: Arc<SecretStore>,
    pub adapters: AdapterRegistry,
}

impl AppState {
    pub fn new(storage: ConfigStore) -> Self {
        Self {
            storage: Arc::new(storage),
            secrets: Arc::new(SecretStore::keyring()),
            adapters: AdapterRegistry::production(),
        }
    }
}
