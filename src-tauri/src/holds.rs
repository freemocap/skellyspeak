//! Durable target admission, independent of conversation lifetime and transport slots.
use crate::{access::ResolvedTarget, model::*};
use rusqlite::{Connection, OptionalExtension, params};
use sha2::{Digest, Sha256};

const MAX_HOLDS: i64 = 128;

fn target_key(target: &ResolvedTarget) -> Result<String> {
    // Hash the native credential reference, never the secret. Length-delimited
    // serialization prevents ambiguous endpoint/credential concatenation.
    let encoded = serde_json::to_vec(&(target.route.label(), &target.url, &target.credential))?;
    Ok(format!("{:x}", Sha256::digest(encoded)))
}

fn keys(target: &ResolvedTarget) -> Result<Vec<String>> {
    let mut keys = vec![target_key(target)?];
    if target.route == ConnectionRoute::Hosted {
        keys.push("hosted-service".into());
    }
    Ok(keys)
}

fn read(db: &Connection, key: &str) -> Result<Option<InferenceHold>> {
    let row: Option<(String, String, String)> = db
        .query_row(
            "SELECT generation,route,error FROM inference_holds WHERE id=?1",
            [key],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    row.map(|(generation, route, error)| {
        Ok(InferenceHold {
            id: key.into(),
            generation,
            route: ConnectionRoute::parse(&route)?,
            error: serde_json::from_str(&error)?,
        })
    })
    .transpose()
}

pub fn record(db: &Connection, target: &ResolvedTarget, error: &AppError) -> Result<()> {
    let Some(refusal) = &error.refusal else {
        return Ok(());
    };
    // A local hold is not a new provider refusal and must not renew its generation.
    if error.code == ErrorCode::AdmissionHeld {
        return Ok(());
    }
    let key = if target.route == ConnectionRoute::Hosted && refusal.service_wide {
        "hosted-service".into()
    } else {
        target_key(target)?
    };
    let existing = read(db, &key)?;
    if existing.is_none()
        && db.query_row("SELECT count(*) FROM inference_holds", [], |r| {
            r.get::<_, i64>(0)
        })? >= MAX_HOLDS
    {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Too many retained AI access holds. Recover or clear held access before creating additional targets.",
        ));
    }
    let mut stored = if existing.as_ref().is_some_and(|h| {
        matches!(
            h.error.refusal.as_ref().map(|r| &r.reason),
            Some(RefusalReason::SpendingPaused)
        )
    }) {
        existing.as_ref().expect("existing hold").error.clone()
    } else {
        error.clone()
    };
    if let Some(previous) = existing
        .and_then(|h| h.error.refusal)
        .and_then(|r| r.retry_at)
        && previous > refusal.retry_at.unwrap_or(0.0)
    {
        stored.refusal.as_mut().expect("refusal metadata").retry_at = Some(previous);
    }
    db.execute("INSERT INTO inference_holds(id,generation,route,error) VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,route=excluded.route,error=excluded.error",
        params![key, uuid::Uuid::new_v4().to_string(), target.route.label(), serde_json::to_string(&stored)?])?;
    Ok(())
}

pub fn check(db: &Connection, target: &ResolvedTarget) -> Result<()> {
    for key in keys(target)? {
        if let Some(hold) = read(db, &key)? {
            return Err(AppError::new(ErrorCode::AdmissionHeld,
                format!("AI access is held. Use Recover access in the execution panel after correcting the cause. {}", hold.error.message))
                .with_refusal(hold.error.refusal.ok_or_else(|| AppError::new(ErrorCode::Storage, "Invalid AI hold."))?));
        }
    }
    if db.query_row("SELECT count(*) FROM inference_holds", [], |r| {
        r.get::<_, i64>(0)
    })? >= MAX_HOLDS
    {
        return Err(AppError::new(
            ErrorCode::AdmissionHeld,
            "AI hold storage is full. Recover held access before starting additional inference.",
        ));
    }
    Ok(())
}

pub fn recover(db: &Connection, id: &str, generation: &str) -> Result<()> {
    let hold = read(db, id)?.ok_or_else(|| {
        AppError::new(
            ErrorCode::Conflict,
            "This AI hold no longer exists. Refresh execution status.",
        )
    })?;
    if hold.generation != generation {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "A new refusal changed this hold. Review its current status before recovery.",
        ));
    }
    if hold
        .error
        .refusal
        .as_ref()
        .and_then(|r| r.retry_at)
        .is_some_and(|at| at > crate::refusal::now())
    {
        return Err(AppError::new(
            ErrorCode::AdmissionHeld,
            "The retry/reset time has not arrived. AI access remains held.",
        ));
    }
    db.execute(
        "DELETE FROM inference_holds WHERE id=?1 AND generation=?2",
        params![id, generation],
    )?;
    // Queued turns stay paused; recovery does not unleash a backlog or make a call.
    Ok(())
}

pub fn views(db: &Connection) -> Result<Vec<InferenceHold>> {
    let ids = db
        .prepare("SELECT id FROM inference_holds ORDER BY rowid")?
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    ids.into_iter()
        .map(|id| {
            read(db, &id)?.ok_or_else(|| {
                AppError::new(ErrorCode::Storage, "AI hold disappeared during snapshot.")
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> (Connection, ResolvedTarget) {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("holds-schema.sql")).unwrap();
        let target = ResolvedTarget {
            route: ConnectionRoute::Openrouter,
            revision: 1,
            url: "https://api.groq.com/openai/v1/audio/transcriptions".into(),
            model: "audio".into(),
            credential: Some("opaque-groq-reference".into()),
        };
        (db, target)
    }
    #[test]
    fn audio_target_hold_isolated_from_chat_keys_and_has_no_automatic_expiry() {
        let (db, target) = setup();
        record(
            &db,
            &target,
            &AppError::new(ErrorCode::Provider, "Rate limited.")
                .with_refusal(crate::refusal::classify(None, None, None)),
        )
        .unwrap();
        assert_eq!(
            check(&db, &target).unwrap_err().code,
            ErrorCode::AdmissionHeld
        );
        let mut other = target.clone();
        other.url = "https://openrouter.ai/api/v1/chat/completions".into();
        other.credential = Some("opaque-openrouter-reference".into());
        check(&db, &other).unwrap();
        other = target.clone();
        other.credential = Some("different-account".into());
        check(&db, &other).unwrap();
        let hold = views(&db).unwrap().remove(0);
        let encoded = serde_json::to_string(&hold).unwrap();
        assert!(!encoded.contains("opaque-groq") && !encoded.contains("groq.com"));
        recover(&db, &hold.id, &hold.generation).unwrap();
        check(&db, &target).unwrap();
    }
    #[test]
    fn hold_capacity_fails_closed_and_spending_pause_is_not_downgraded() {
        let (db, mut target) = setup();
        target.route = ConnectionRoute::Hosted;
        let paused = AppError::new(ErrorCode::Provider, "Spending paused.").with_refusal(
            crate::refusal::classify(Some("SPENDING_PAUSED"), None, None),
        );
        record(&db, &target, &paused).unwrap();
        record(
            &db,
            &target,
            &AppError::new(ErrorCode::Provider, "Rate limited.").with_refusal(
                crate::refusal::classify(Some("INGRESS_RATE_LIMIT"), Some(60), None),
            ),
        )
        .unwrap();
        assert!(matches!(
            views(&db).unwrap()[0]
                .error
                .refusal
                .as_ref()
                .unwrap()
                .reason,
            RefusalReason::SpendingPaused
        ));
        target.route = ConnectionRoute::Openrouter;
        for index in 1..MAX_HOLDS {
            target.credential = Some(format!("test-reference-{index}"));
            record(
                &db,
                &target,
                &AppError::new(ErrorCode::Provider, "Refused.")
                    .with_refusal(crate::refusal::classify(None, None, None)),
            )
            .unwrap();
        }
        target.credential = Some("new-reference".into());
        assert!(check(&db, &target).is_err());
        assert_eq!(views(&db).unwrap().len(), MAX_HOLDS as usize);
    }

    #[tokio::test]
    async fn refusal_arriving_during_audio_capacity_wait_prevents_admission() {
        let (db, target) = setup();
        let admission = crate::admission::Admission::new();
        let running: Vec<_> = (0..crate::admission::NETWORK_CAPACITY)
            .map(|_| admission.try_chat().unwrap())
            .collect();
        let audio = admission.audio(|| check(&db, &target));
        tokio::pin!(audio);
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(10), &mut audio)
                .await
                .is_err()
        );
        record(
            &db,
            &target,
            &AppError::new(ErrorCode::Provider, "Refused.")
                .with_refusal(crate::refusal::classify(None, None, None)),
        )
        .unwrap();
        assert_eq!(audio.await.unwrap_err().code, ErrorCode::AdmissionHeld);
        drop(running);
        let hold = views(&db).unwrap().remove(0);
        recover(&db, &hold.id, &hold.generation).unwrap();
        assert!(admission.audio(|| check(&db, &target)).await.is_ok());
    }

    #[test]
    fn recovery_honors_timing_generation_and_local_checks_do_not_renew_holds() {
        let (db, target) = setup();
        let error = AppError::new(ErrorCode::Provider, "Rate limited.")
            .with_refusal(crate::refusal::classify(None, Some(60), None));
        record(&db, &target, &error).unwrap();
        let first = views(&db).unwrap().remove(0);
        assert!(recover(&db, &first.id, &first.generation).is_err());
        record(&db, &target, &check(&db, &target).unwrap_err()).unwrap();
        assert_eq!(views(&db).unwrap()[0].generation, first.generation);
        record(&db, &target, &error).unwrap();
        db.execute(
            "UPDATE inference_holds SET error=json_set(error,'$.refusal.retryAt',0)",
            [],
        )
        .unwrap();
        assert!(recover(&db, &first.id, &first.generation).is_err());
        let current = views(&db).unwrap().remove(0);
        recover(&db, &current.id, &current.generation).unwrap();
        check(&db, &target).unwrap();
    }
}
