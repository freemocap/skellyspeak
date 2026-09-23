//! Durable phrase-owned media. Provider execution and receipts stay with reading.
use crate::{
    language::reading::{ReadingAid, Request},
    model::*,
    storage::store::Store,
};
use rusqlite::{OptionalExtension, params};
use sha2::{Digest, Sha256};

// A bounded regenerable cache, independent of retained learner recordings.
const BUDGET: usize = crate::speech::cache::CACHE_BYTES;

pub(crate) fn validate(store: &Store, request: &Request) -> Result<()> {
    let Some(item) = &request.input.reference_item else {
        return Ok(());
    };
    let valid: bool = store.connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM drill_items WHERE id=?1 AND text=?2 AND language_id=?3 AND variety_id=?4 AND archived=0)",
        params![item, request.input.text, request.context.language_id, request.context.variety_id], |r| r.get(0))?;
    if request.input.aid != ReadingAid::Speech || !valid {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "The reference phrase no longer matches this speech request.",
        ));
    }
    Ok(())
}

fn key(request: &Request) -> Result<String> {
    let input = request.speech_input()?;
    let bytes = serde_json::to_vec(&serde_json::json!({
        "version":1,"text":input.text,"voice":input.voice,"language":input.language,
        "scope":request.context.hash(),"config":request.config_hash,"target":request.target
    }))?;
    // Never put source content, endpoint URLs or credential identifiers in receipts.
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

pub(crate) fn get(store: &Store, request: &Request) -> Result<Option<(Vec<u8>, String)>> {
    let Some(item) = &request.input.reference_item else {
        return Ok(None);
    };
    validate(store, request)?;
    let cached = store
        .connection
        .query_row(
            "SELECT audio,receipt_id FROM drill_references WHERE drill_item_id=?1 AND cache_key=?2",
            params![item, key(request)?],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    if cached.is_some() {
        store.connection.execute("UPDATE drill_references SET last_used=(SELECT COALESCE(MAX(last_used),0)+1 FROM drill_references) WHERE drill_item_id=?1", [item])?;
    }
    Ok(cached)
}

/// Called in the receipt completion transaction, so paid output and provenance
/// become durable together. Replacing/evicting media never removes usage receipts.
pub(crate) fn put(store: &Store, request: &Request, audio: &[u8]) -> Result<()> {
    let Some(item) = &request.input.reference_item else {
        return Ok(());
    };
    validate(store, request)?;
    if audio.is_empty() || audio.len() > crate::speech::cache::AUDIO_LIMIT {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Reference audio exceeds its cache limits.",
        ));
    }
    store.connection.execute("INSERT INTO drill_references(drill_item_id,cache_key,audio,receipt_id,last_used) VALUES(?1,?2,?3,?4,(SELECT COALESCE(MAX(last_used),0)+1 FROM drill_references)) ON CONFLICT(drill_item_id) DO UPDATE SET cache_key=excluded.cache_key,audio=excluded.audio,receipt_id=excluded.receipt_id,last_used=excluded.last_used", params![item,key(request)?,audio,request.id])?;
    loop {
        let bytes: i64 = store.connection.query_row(
            "SELECT COALESCE(SUM(length(audio)),0) FROM drill_references",
            [],
            |r| r.get(0),
        )?;
        if bytes <= BUDGET as i64 {
            break;
        }
        store.connection.execute("DELETE FROM drill_references WHERE drill_item_id=(SELECT drill_item_id FROM drill_references ORDER BY last_used,drill_item_id LIMIT 1)", [])?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "reference_tests.rs"]
mod tests;
