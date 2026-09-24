//! Shared execution settings and identity, independent of product workflows.
use crate::model::*;
use rusqlite::Connection;

pub fn config(db: &Connection) -> Result<ConnectionConfig> {
    let (revision,standard,fast,transcription,paused,route,hosted,email):(i32,String,String,String,bool,String,bool,String)=db.query_row("SELECT revision,standard_model,fast_model,audio_settings,paused,route,hosted_credential_id IS NOT NULL,hosted_email FROM ai_config WHERE singleton=1",[],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?)))?;
    let route = ConnectionRoute::parse(&route)?;
    let access = crate::ai::connections::access::settings(db)?;
    Ok(ConnectionConfig {
        assessment_adapter: serde_json::from_value(serde_json::Value::String(db.query_row(
            "SELECT assessment_adapter FROM ai_config",
            [],
            |r| r.get(0),
        )?))?,
        revision,
        configured: if route == ConnectionRoute::Hosted {
            hosted
        } else {
            !access.custom.base_url.is_empty()
                && (!access.custom.bearer_auth || access.custom_key_configured)
        },
        standard_model: standard,
        fast_model: fast,
        audio: serde_json::from_str(&transcription)?,
        paused,
        route,
        signed_in: hosted,
        email,
    })
}

pub(crate) fn active_credential(db: &Connection) -> Result<Option<String>> {
    Ok(db.query_row("SELECT CASE route WHEN 'hosted' THEN hosted_credential_id WHEN 'custom' THEN CASE WHEN json_extract(custom_config,'$.bearerAuth') THEN custom_credential_id ELSE '' END ELSE NULL END FROM ai_config",[],|r|r.get(0))?)
}
