//! Persist rate-limit refusals during a live attempt without publishing a result.
use super::*;

impl Store {
    pub(crate) fn record_retry(&mut self, dispatch: &Dispatch, error: &AppError) -> Result<()> {
        let tx = self.connection.transaction()?;
        let changed = tx.execute(
            "UPDATE attempts SET diagnostics=?2 WHERE id=?1 AND operation_id=?3 AND state='running'",
            params![dispatch.attempt, crate::diagnostics::response::retained(None, Some(error)), dispatch.operation],
        )?;
        if changed == 0 {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Operation ended before retry.",
            ));
        }
        bump(&tx)?;
        tx.commit()?;
        Ok(())
    }
}
