use super::*;

pub fn config(db: &Connection) -> Result<ConnectionConfig> {
    let (revision,key,standard,fast,paused,route,hosted,email):(i32,bool,String,String,bool,String,bool,String)=db.query_row("SELECT revision,credential_id IS NOT NULL,standard_model,fast_model,paused,route,hosted_credential_id IS NOT NULL,hosted_email FROM ai_config WHERE singleton=1",[],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?)))?;
    let route = ConnectionRoute::parse(&route)?;
    let access = crate::ai::connections::access::settings(db)?;
    Ok(ConnectionConfig {
        revision,
        configured: if route == ConnectionRoute::Hosted {
            hosted
        } else if route == ConnectionRoute::Custom {
            !access.custom.base_url.is_empty()
                && (!access.custom.bearer_auth || access.custom_key_configured)
        } else {
            key
        },
        standard_model: if route == ConnectionRoute::Hosted {
            "google/gemini-2.5-flash".into()
        } else if route == ConnectionRoute::Custom {
            access.custom.standard_model
        } else {
            standard
        },
        fast_model: if route == ConnectionRoute::Custom {
            access.custom.fast_model
        } else {
            fast
        },
        paused,
        route,
        signed_in: hosted,
        own_key_configured: key,
        email,
    })
}

pub(crate) fn new_attempt_id() -> String {
    format!(
        "{:010}-{}",
        crate::ai::policy::refusal::now() as u64,
        Uuid::new_v4().simple()
    )
}

pub(crate) fn active_credential(db: &Connection) -> Result<Option<String>> {
    Ok(db.query_row("SELECT CASE route WHEN 'hosted' THEN hosted_credential_id WHEN 'custom' THEN CASE WHEN json_extract(custom_config,'$.bearerAuth') THEN custom_credential_id ELSE '' END ELSE credential_id END FROM ai_config",[],|r|r.get(0))?)
}

pub(crate) fn invalidate(db: &Connection, revoked: Option<ConnectionRoute>) -> Result<()> {
    db.execute("UPDATE turns SET state='invalidated' WHERE state IN ('pending','assisting') AND (route=?1 OR NOT EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=turns.id AND o.state='running'))",[revoked.map(|r|r.label())])?;
    db.execute("UPDATE operations SET state='invalidated',permit=0 WHERE state IN ('ready','running','waiting_dependencies') AND turn_id IN (SELECT id FROM turns WHERE state='invalidated')",[])?;
    // A running parent keeps publication authority, but cannot authorize new
    // dependency work under a superseded profile.
    db.execute("UPDATE operations SET state='invalidated',permit=0 WHERE state IN ('ready','waiting_dependencies') AND turn_id IN (SELECT id FROM turns WHERE state IN ('pending','assisting'))", [])?;
    db.execute("UPDATE attempts SET state='invalidated',finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),error='Connection authority changed.' WHERE state='running' AND operation_id IN (SELECT id FROM operations WHERE state='invalidated')",[])?;
    Ok(())
}

impl Store {
    pub fn note_refusal(
        &mut self,
        target: &crate::ai::connections::access::ResolvedTarget,
        error: &AppError,
    ) -> Result<()> {
        let tx = self.connection.transaction()?;
        pause_related(&tx, target, error)?;
        tx.commit()?;
        Ok(())
    }

    pub fn connection_config(&self) -> Result<ConnectionConfig> {
        config(&self.connection)
    }

    pub fn reserve_credential(&mut self, id: &str) -> Result<()> {
        self.connection
            .execute("INSERT INTO credential_cleanup VALUES(?1)", [id])?;
        self.credential_writes.insert(id.to_owned());
        Ok(())
    }

    pub fn claim_credential_cleanup(&mut self) -> Result<Option<String>> {
        let ids = self
            .connection
            .prepare("SELECT id FROM credential_cleanup")?
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        for id in ids {
            if !self.credential_writes.contains(&id) {
                self.credential_writes.insert(id.clone());
                return Ok(Some(id));
            }
        }
        Ok(None)
    }

    pub fn finish_credential_cleanup(&mut self, id: &str, removed: bool) -> Result<()> {
        self.credential_writes.remove(id);
        if removed {
            self.connection
                .execute("DELETE FROM credential_cleanup WHERE id=?1", [id])?;
        }
        Ok(())
    }

    pub fn credential_id(&self) -> Result<Option<String>> {
        Ok(self
            .connection
            .query_row("SELECT credential_id FROM ai_config", [], |r| r.get(0))?)
    }

    pub fn set_connection(
        &mut self,
        expected: i32,
        credential: Option<&str>,
        standard: &str,
        fast: &str,
    ) -> Result<()> {
        if standard.len() > 160
            || fast.len() > 160
            || [standard, fast].iter().any(|s| {
                s.is_empty()
                    || !s
                        .bytes()
                        .all(|c| c.is_ascii_alphanumeric() || b"/._:-".contains(&c))
            })
        {
            return Err(fail(
                "Provide explicit valid model IDs for Standard and Fast.",
            ));
        }
        let tx = self.connection.transaction()?;
        if config(&tx)?.revision != expected {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "AI connection changed. Reload its settings.",
            ));
        }
        tx.execute("INSERT OR IGNORE INTO credential_cleanup SELECT credential_id FROM ai_config WHERE credential_id IS NOT NULL AND credential_id IS NOT ?1",[credential])?;
        if let Some(id) = credential {
            tx.execute("DELETE FROM credential_cleanup WHERE id=?1", [id])?;
        }
        tx.execute("UPDATE ai_config SET revision=revision+1,credential_id=?1,standard_model=?2,fast_model=?3",params![credential,standard,fast])?;
        invalidate(&tx, Some(ConnectionRoute::Openrouter))?;
        bump(&tx)?;
        tx.commit()?;
        Ok(())
    }

    pub fn hosted_credential(&self) -> Result<Option<String>> {
        Ok(self
            .connection
            .query_row("SELECT hosted_credential_id FROM ai_config", [], |r| {
                r.get(0)
            })?)
    }

    pub fn set_hosted_connection(
        &mut self,
        expected: i32,
        credential: Option<&str>,
        email: &str,
    ) -> Result<()> {
        let tx = self.connection.transaction()?;
        if config(&tx)?.revision != expected {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "AI settings changed. Reload before continuing.",
            ));
        }
        tx.execute("INSERT OR IGNORE INTO credential_cleanup SELECT hosted_credential_id FROM ai_config WHERE hosted_credential_id IS NOT NULL AND hosted_credential_id IS NOT ?1",[credential])?;
        if let Some(id) = credential {
            tx.execute("DELETE FROM credential_cleanup WHERE id=?1", [id])?;
        }
        tx.execute(
            "UPDATE ai_config SET revision=revision+1,hosted_credential_id=?1,hosted_email=?2",
            params![credential, email],
        )?;
        invalidate(&tx, Some(ConnectionRoute::Hosted))?;
        bump(&tx)?;
        tx.commit()?;
        Ok(())
    }

    pub fn select_route(&mut self, expected: i32, route: ConnectionRoute) -> Result<()> {
        let tx = self.connection.transaction()?;
        if config(&tx)?.revision != expected {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "AI settings changed. Reload before switching.",
            ));
        }
        tx.execute(
            "UPDATE ai_config SET revision=revision+1,route=?1",
            [route.label()],
        )?;
        invalidate(&tx, None)?;
        bump(&tx)?;
        tx.commit()?;
        Ok(())
    }
}
