//! Provider configuration: local vs remote, for the LLM and for transcription.

use serde::{Deserialize, Serialize};

use crate::llm::{
    AiClient, AnthropicCompatibleClient, LlmError, OpenAiCompatibleClient,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderMode {
    Local,
    Remote,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ApiFormat {
    OpenAi,
    Anthropic,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmProviderConfig {
    pub mode: ProviderMode,
    pub format: ApiFormat,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SttProviderConfig {
    pub mode: ProviderMode,
    pub format: ApiFormat,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSettings {
    pub llm: LlmProviderConfig,
    pub stt: SttProviderConfig,
}

impl Default for LlmProviderConfig {
    fn default() -> Self {
        Self {
            mode: ProviderMode::Remote,
            format: ApiFormat::OpenAi,
            base_url: "https://openrouter.ai/api/v1".into(),
            api_key: String::new(),
            model: "anthropic/claude-sonnet-4.5".into(),
        }
    }
}

impl Default for SttProviderConfig {
    fn default() -> Self {
        Self {
            mode: ProviderMode::Remote,
            format: ApiFormat::OpenAi,
            base_url: "https://openrouter.ai/api/v1".into(),
            api_key: String::new(),
            model: "openai/whisper-large-v3-turbo".into(),
        }
    }
}

impl Default for ProviderSettings {
    fn default() -> Self {
        Self {
            llm: LlmProviderConfig::default(),
            stt: SttProviderConfig::default(),
        }
    }
}

/// A unified LLM client that dispatches to an OpenAI- or Anthropic-compatible
/// backend. Kept as an enum (not a trait object) because \`AiClient\` is generic.
pub enum LlmClient {
    OpenAi(OpenAiCompatibleClient),
    Anthropic(AnthropicCompatibleClient),
}

impl LlmClient {
    /// Stream a plain-text completion, emitting each delta through `on_delta`
    /// and returning the full accumulated text.
    pub fn stream_text<F: FnMut(&str)>(
        &self,
        system_prompt: &str,
        on_delta: F,
    ) -> Result<String, LlmError> {
        match self {
            LlmClient::OpenAi(c) => c.stream_text(system_prompt, on_delta),
            LlmClient::Anthropic(c) => c.stream_text(system_prompt, on_delta),
        }
    }

    pub fn from_config(cfg: &LlmProviderConfig) -> Result<Self, LlmError> {
        let key = if cfg.api_key.trim().is_empty() {
            None
        } else {
            Some(cfg.api_key.trim().to_string())
        };
        match cfg.format {
            ApiFormat::OpenAi => Ok(LlmClient::OpenAi(OpenAiCompatibleClient::new(
                cfg.base_url.clone(),
                cfg.model.clone(),
                key,
            )?)),
            ApiFormat::Anthropic => Ok(LlmClient::Anthropic(AnthropicCompatibleClient::new(
                cfg.base_url.clone(),
                cfg.model.clone(),
                key,
            )?)),
        }
    }
}

impl AiClient for LlmClient {
    fn complete_structured<T>(&self, system_prompt: &str, response_name: &str) -> Result<T, LlmError>
    where
        T: serde::de::DeserializeOwned + schemars::JsonSchema,
    {
        match self {
            LlmClient::OpenAi(c) => c.complete_structured(system_prompt, response_name),
            LlmClient::Anthropic(c) => c.complete_structured(system_prompt, response_name),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_remote_openrouter() {
        let s = ProviderSettings::default();
        assert_eq!(s.llm.mode, ProviderMode::Remote);
        assert_eq!(s.stt.mode, ProviderMode::Remote);
        assert_eq!(s.llm.base_url, "https://openrouter.ai/api/v1");
        assert_eq!(s.stt.base_url, "https://openrouter.ai/api/v1");
        assert_eq!(s.llm.model, "anthropic/claude-sonnet-4.5");
        assert_eq!(s.stt.model, "openai/whisper-large-v3-turbo");
    }

    #[test]
    fn llm_client_openai() {
        let cfg = LlmProviderConfig {
            format: ApiFormat::OpenAi,
            base_url: "http://localhost:1234/v1".into(),
            ..LlmProviderConfig::default()
        };
        assert!(matches!(LlmClient::from_config(&cfg).unwrap(), LlmClient::OpenAi(_)));
    }

    #[test]
    fn llm_client_anthropic() {
        let cfg = LlmProviderConfig {
            format: ApiFormat::Anthropic,
            base_url: "https://api.anthropic.com/v1".into(),
            api_key: "sk-test".into(),
            ..LlmProviderConfig::default()
        };
        assert!(matches!(LlmClient::from_config(&cfg).unwrap(), LlmClient::Anthropic(_)));
    }

    #[test]
    fn provider_mode_serde_lowercase() {
        let v = serde_json::to_value(ProviderSettings::default()).unwrap();
        assert_eq!(v["llm"]["mode"], "remote");
        assert_eq!(v["llm"]["format"], "openai");
        let back: ProviderSettings = serde_json::from_value(v).unwrap();
        assert_eq!(back.llm.mode, ProviderMode::Remote);
    }
}
