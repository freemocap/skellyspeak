//! Typed local failure context. Never format poisoned state, panic payloads,
//! audio bytes, or credential containers into error messages.
use crate::model::AppError;
use serde_json::json;

pub fn join(error: &tauri::Error, stage: &str, failure: AppError) -> AppError {
    let tauri::Error::JoinError(error) = error else {
        return failure.with_diagnostics(json!({"stage":stage,"reason":"unexpected_task_runtime_error","message":super::response::scrub(&error.to_string(), &[])}));
    };
    failure.with_diagnostics(
        json!({"stage":stage,"reason":if error.is_panic() {"task_panicked"} else {"task_cancelled"},
        "redaction":"panic payload omitted; panic hook records scrubbed explanation and location"}),
    )
}

#[track_caller]
pub fn poisoned(failure: AppError) -> AppError {
    let at = std::panic::Location::caller();
    failure.with_diagnostics(json!({"stage":"synchronization","reason":"mutex_poisoned",
        "source_file":at.file(),"line":at.line(),"column":at.column()}))
}

pub fn utf8(error: &std::str::Utf8Error, stage: &str, failure: AppError) -> AppError {
    failure.with_diagnostics(json!({"stage":stage,"reason":"invalid_utf8",
        "valid_up_to":error.valid_up_to(),"error_length":error.error_len()}))
}

pub fn wav(error: &hound::Error, stage: &str, failure: AppError) -> AppError {
    use hound::Error;
    let reason = match error {
        Error::IoError(cause) => return super::response::io_context(cause, stage, failure),
        Error::FormatError(reason) => *reason, // Library-authored static format explanation.
        Error::TooWide => "sample_exceeds_bit_depth",
        Error::UnfinishedSample => "unfinished_sample",
        Error::Unsupported => "unsupported_format",
        Error::InvalidSampleFormat => "invalid_sample_format",
    };
    failure.with_diagnostics(json!({"stage":stage,"reason":reason}))
}

/// Reviewed platform operations: caller supplies every private URL/token/content value.
/// Never use this for parsing provider content or formatting state/credential objects.
pub fn platform(
    error: &dyn std::error::Error,
    stage: &str,
    private: &[&str],
    failure: AppError,
) -> AppError {
    let mut causes = Vec::new();
    let mut source = Some(error);
    while let Some(error) = source {
        if causes.len() == 8 {
            break;
        }
        causes.push(json!({"message":super::response::scrub(&error.to_string(), private)}));
        source = error.source();
    }
    failure.with_diagnostics(
        json!({"stage":stage,"causes":causes,"causes_truncated":source.is_some()}),
    )
}

pub fn yaml(error: &serde_yaml_ng::Error, stage: &str, failure: AppError) -> AppError {
    failure.with_diagnostics(json!({"stage":stage,"reason":"invalid_yaml",
        "line":error.location().map(|p| p.line()),"column":error.location().map(|p| p.column()),
        "message":"[user content redacted]"}))
}

pub fn base64(error: &base64::DecodeError, stage: &str, failure: AppError) -> AppError {
    let details = match error {
        base64::DecodeError::InvalidByte(offset, _) => {
            json!({"reason":"invalid_base64_byte","offset":offset})
        }
        base64::DecodeError::InvalidLength(length) => {
            json!({"reason":"invalid_base64_length","length":length})
        }
        base64::DecodeError::InvalidLastSymbol(offset, _) => {
            json!({"reason":"invalid_base64_last_symbol","offset":offset})
        }
        base64::DecodeError::InvalidPadding => json!({"reason":"invalid_base64_padding"}),
    };
    failure.with_diagnostics(json!({"stage":stage,"cause":details}))
}

/// One durable path for background failures that have no IPC caller to report them.
pub fn report(stage: &str, error: &AppError) {
    let event = json!({"code":"background_failure","level":"ERROR","stage":stage,
        "error":super::response::error_metadata(error, &[])});
    if let Err(sink) = super::append_native(&event) {
        super::fallback(stage, &event, &sink);
    }
}

/// SQLite Display can contain whole SQL strings and rejected data. Preserve its
/// numerical identity and typed details; never stringify the statement/payload.
#[track_caller]
pub fn sqlite(error: &rusqlite::Error) -> AppError {
    use rusqlite::Error;
    let at = std::panic::Location::caller();
    let mut details =
        json!({"stage":"sqlite","source_file":at.file(),"line":at.line(),"column":at.column()});
    let reason = match error {
        Error::SqliteFailure(code, message) => {
            details["message"] = json!(message.as_ref().map(|m| super::response::scrub(m, &[])));
            details["extended_code"] = json!(code.extended_code);
            format!("{:?}", code.code)
        }
        Error::SqlInputError { error, offset, .. } => {
            details["extended_code"] = json!(error.extended_code);
            details["offset"] = json!(offset);
            format!("{:?}", error.code)
        }
        Error::QueryReturnedNoRows => "query_returned_no_rows".into(),
        Error::InvalidColumnIndex(index) => {
            details["index"] = json!(index);
            "invalid_column_index".into()
        }
        Error::InvalidColumnType(index, _, kind) => {
            details["index"] = json!(index);
            details["type"] = json!(format!("{kind:?}"));
            "invalid_column_type".into()
        }
        Error::InvalidParameterCount(actual, expected) => {
            details["actual_count"] = json!(actual);
            details["expected_count"] = json!(expected);
            "invalid_parameter_count".into()
        }
        Error::FromSqlConversionFailure(index, kind, cause) => {
            details["index"] = json!(index);
            details["type"] = json!(format!("{kind:?}"));
            if let Some(error) = cause.downcast_ref::<serde_json::Error>() {
                details["cause"] = super::response::json_context(
                    error,
                    "sqlite_column_decode",
                    AppError::new(
                        crate::model::ErrorCode::Storage,
                        "Stored column could not be decoded.",
                    ),
                )
                .diagnostics
                .unwrap_or(serde_json::Value::Null);
            } else {
                details["cause"] = json!({"message":"[user content redacted]"});
            }
            "column_conversion_failed".into()
        }
        Error::IntegralValueOutOfRange(index, _) => {
            details["index"] = json!(index);
            "integer_out_of_range".into()
        }
        Error::ExecuteReturnedResults => "execute_returned_results".into(),
        Error::InvalidQuery => "invalid_query".into(),
        Error::InvalidColumnName(_) => "invalid_column_name".into(),
        Error::InvalidParameterName(_) => "invalid_parameter_name".into(),
        _ => "sqlite_operation_failed".into(),
    };
    details["reason"] = json!(reason);
    AppError::new(
        crate::model::ErrorCode::Storage,
        format!("Database operation failed: {reason}."),
    )
    .with_diagnostics(details)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::ErrorCode;
    #[test]
    fn wav_and_io_keep_actionable_causes_without_audio_or_paths() {
        let error = wav(
            &hound::Error::FormatError("no RIFF tag found"),
            "wav_header",
            AppError::new(ErrorCode::Provider, "Invalid audio"),
        );
        assert_eq!(error.diagnostics.unwrap()["reason"], "no RIFF tag found");
        let error = wav(
            &hound::Error::IoError(std::io::Error::from_raw_os_error(13)),
            "wav_samples",
            AppError::new(ErrorCode::Provider, "Invalid audio"),
        );
        assert_eq!(error.diagnostics.unwrap()["os_code"], 13);
    }
}
