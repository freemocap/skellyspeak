//! Device-local reward presentation preferences; never part of model prompts.
use crate::{Application, model::*};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RewardSettings {
    pub revision: i32,
    pub fast_mode: bool,
    pub reward_sounds: String,
    pub master_volume: u8,
    pub voice_volume: u8,
    pub effects_volume: u8,
}
pub fn initialize(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS reward_settings(singleton INTEGER PRIMARY KEY CHECK(singleton=1), settings TEXT NOT NULL CHECK(json_valid(settings))); INSERT OR IGNORE INTO reward_settings VALUES(1,'{\"revision\":0,\"fastMode\":true,\"rewardSounds\":\"follow_tts\",\"masterVolume\":100,\"voiceVolume\":100,\"effectsVolume\":100}');")?;
    db.execute_batch("CREATE TABLE IF NOT EXISTS voice_playback(singleton INTEGER PRIMARY KEY CHECK(singleton=1),rate REAL NOT NULL CHECK(rate BETWEEN 0.5 AND 1.5)); INSERT OR IGNORE INTO voice_playback VALUES(1,1.0);")?;
    Ok(())
}
#[tauri::command]
pub(crate) fn get_playback_rate(state: tauri::State<'_, Arc<Application>>) -> Result<f64> {
    Ok(state.lock()?.connection.query_row(
        "SELECT rate FROM voice_playback WHERE singleton=1",
        [],
        |r| r.get(0),
    )?)
}
#[tauri::command]
pub(crate) fn save_playback_rate(
    state: tauri::State<'_, Arc<Application>>,
    rate: f64,
) -> Result<()> {
    if !rate.is_finite() || !(0.5..=1.5).contains(&rate) {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Voice speed must be between 0.5 and 1.5.",
        ));
    }
    state.lock()?.connection.execute(
        "UPDATE voice_playback SET rate=?1 WHERE singleton=1",
        [rate],
    )?;
    Ok(())
}
fn read(db: &Connection) -> Result<RewardSettings> {
    let text: String = db.query_row(
        "SELECT settings FROM reward_settings WHERE singleton=1",
        [],
        |r| r.get(0),
    )?;
    Ok(serde_json::from_str(&text)?)
}
fn save(db: &Connection, mut settings: RewardSettings) -> Result<()> {
    if [
        settings.master_volume,
        settings.voice_volume,
        settings.effects_volume,
    ]
    .iter()
    .any(|v| *v > 100)
        || !["yes", "no", "follow_tts"].contains(&settings.reward_sounds.as_str())
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Invalid reward sound settings.",
        ));
    }
    if read(db)?.revision != settings.revision {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Reward settings changed. Reload settings.",
        ));
    }
    settings.revision += 1;
    db.execute(
        "UPDATE reward_settings SET settings=?1 WHERE singleton=1",
        params![serde_json::to_string(&settings)?],
    )?;
    Ok(())
}
#[tauri::command]
pub(crate) fn get_reward_settings(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<RewardSettings> {
    read(&state.lock()?.connection)
}
#[tauri::command]
pub(crate) fn save_reward_settings(
    state: tauri::State<'_, Arc<Application>>,
    settings: RewardSettings,
) -> Result<()> {
    save(&state.lock()?.connection, settings)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_and_muted_preferences_survive_reopening() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("preferences.db");
        let db = Connection::open(&path).unwrap();
        initialize(&db).unwrap();
        let mut value = read(&db).unwrap();
        assert!(value.fast_mode);
        assert_eq!(value.effects_volume, 100);
        value.reward_sounds = "no".into();
        value.master_volume = 35;
        save(&db, value.clone()).unwrap();
        assert!(save(&db, value).is_err());
        drop(db);
        let db = Connection::open(path).unwrap();
        initialize(&db).unwrap();
        assert_eq!(read(&db).unwrap().master_volume, 35);
        assert_eq!(read(&db).unwrap().reward_sounds, "no");
        let mut value = read(&db).unwrap();
        value.effects_volume = 101;
        assert!(save(&db, value).is_err());
    }
}
