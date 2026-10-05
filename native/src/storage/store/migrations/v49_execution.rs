//! Add workspace execution preferences without changing accepted work or results.
use super::*;

pub(super) fn apply(db: &Connection) -> Result<()> {
    db.execute_batch(r#"UPDATE learner SET preferences=json_set(preferences,'$.execution',
        json('{"assessment":"automatic","coaching":"on_demand","replyBrief":"on_demand","reading":"on_demand"}'))
        WHERE json_type(preferences)='object' AND json_type(preferences,'$.execution') IS NULL;"#)?;
    Ok(())
}

pub(super) fn validate(db: &Connection) -> Result<()> {
    v48_assessment::validate(db)?;
    let invalid: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM learner WHERE json_type(preferences,'$.execution') IS NOT 'object'
        OR (SELECT count(*) FROM json_each(preferences,'$.execution'))!=4
        OR json_extract(preferences,'$.execution.assessment') NOT IN ('automatic','on_demand')
        OR json_extract(preferences,'$.execution.coaching') NOT IN ('automatic','on_demand')
        OR json_extract(preferences,'$.execution.replyBrief') NOT IN ('automatic','on_demand')
        OR json_extract(preferences,'$.execution.reading') NOT IN ('automatic','on_demand')
        OR EXISTS(SELECT 1 FROM json_each(preferences,'$.execution') WHERE key NOT IN ('assessment','coaching','replyBrief','reading') OR type!='text'))",
        [], |r| r.get(0),
    )?;
    if invalid {
        return Err(AppError::new(
            ErrorCode::Storage,
            "Invalid workspace execution preferences.",
        ));
    }
    Ok(())
}
