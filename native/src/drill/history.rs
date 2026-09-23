//! Stable keyset pages: newly published attempts never move older page boundaries.
use super::*;

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DrillAttemptPage {
    pub attempts: Vec<DrillAttemptView>,
    pub next_cursor: Option<String>,
}

impl Store {
    pub fn drill_attempts(
        &self,
        item_id: &str,
        cursor: Option<&str>,
        limit: u32,
    ) -> Result<DrillAttemptPage> {
        if !(1..=100).contains(&limit) {
            return Err(invalid("Choose a history page size between 1 and 100."));
        }
        if !owner(item_id).available(&self.connection)? {
            return Err(AppError::new(
                ErrorCode::NotFound,
                "This drill item no longer exists.",
            ));
        }
        let before = match cursor {
            None => None,
            Some(cursor) => {
                if cursor.len() > 256 {
                    return Err(invalid("Invalid attempt history cursor."));
                }
                let (version, item, sequence): (u8, String, i64) = serde_json::from_str(cursor)
                    .map_err(|_| invalid("Invalid attempt history cursor."))?;
                if version != 1 || item != item_id || sequence < 1 {
                    return Err(invalid(
                        "This history cursor does not belong to the selected phrase.",
                    ));
                }
                Some(sequence)
            }
        };
        let mut rows = self.connection.prepare("SELECT id,sequence FROM drill_attempts WHERE drill_item_id=?1 AND (?2 IS NULL OR sequence<?2) ORDER BY sequence DESC LIMIT ?3")?
            .query_map(params![item_id,before,limit+1], |r| Ok((r.get::<_,String>(0)?,r.get::<_,i64>(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let more = rows.len() > limit as usize;
        rows.truncate(limit as usize);
        let next_cursor = if more {
            rows.last()
                .map(|(_, sequence)| serde_json::to_string(&(1, item_id, sequence)))
                .transpose()?
        } else {
            None
        };
        Ok(DrillAttemptPage {
            attempts: rows
                .iter()
                .map(|(id, _)| attempt(&self.connection, id))
                .collect::<Result<_>>()?,
            next_cursor,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pages_are_stable_during_publication_and_summaries_cover_all_history() {
        let dir = tempfile::tempdir().unwrap();
        let mut store = Store::open(&dir.path().join("history.sqlite3")).unwrap();
        let item = store
            .create_drill_item(DrillItemInput {
                text: "Hola".into(),
                language: "spanish".into(),
                variety: None,
                explanation: "english".into(),
                explanation_variety: None,
            })
            .unwrap();
        assert_eq!(item.attempt_count, 0);
        assert_eq!(item.best_match_ratio, None);
        assert_eq!(item.last_attempt_at, None);
        for i in 0..55 {
            stage_attempt(
                &store.connection,
                &item.id,
                None,
                if i == 0 { "Hola" } else { "x" },
                None,
            )
            .unwrap();
        }
        let summary = store.drill_items("spanish").unwrap().remove(0);
        assert_eq!(summary.attempt_count, 55);
        assert_eq!(summary.attempts.len(), 50); // Compatibility array is still bounded.
        assert_eq!(summary.best_match_ratio, Some(1.0)); // Best attempt is outside that array.
        assert!(summary.last_attempt_at.is_some());
        let first = store.drill_attempts(&item.id, None, 20).unwrap();
        assert_eq!(first.attempts[0].sequence, 55);
        stage_attempt(&store.connection, &item.id, None, "new", None).unwrap();
        let second = store
            .drill_attempts(&item.id, first.next_cursor.as_deref(), 20)
            .unwrap();
        assert_eq!(second.attempts[0].sequence, 35);
        let last = store
            .drill_attempts(&item.id, second.next_cursor.as_deref(), 20)
            .unwrap();
        assert_eq!(last.attempts.len(), 15);
        assert_eq!(last.attempts.last().unwrap().sequence, 1);
        assert!(last.next_cursor.is_none());
        assert!(store.drill_attempts(&item.id, None, 0).is_err());
        assert!(store.drill_attempts(&item.id, None, 101).is_err());
        assert!(store.drill_attempts(&item.id, Some("invalid"), 20).is_err());
        assert!(
            store
                .drill_attempts(&item.id, Some("[1,\"another-item\",35]"), 20)
                .is_err()
        );
        assert!(store.drill_attempts("missing", None, 20).is_err());
    }
}
