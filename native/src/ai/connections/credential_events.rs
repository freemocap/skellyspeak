//! Credential I/O timing only. Never records identifiers, values or secret lengths.
use crate::model::Result;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

pub(super) fn observe<T>(operation: u64, action: impl FnOnce() -> Result<T>) -> Result<T> {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    let sequence = NEXT.fetch_add(1, Ordering::Relaxed);
    let started = Instant::now();
    // Operation codes: 1 read, 2 write, 3 delete. A start with no completion
    // distinguishes blocked system interaction from a cached read or a restart.
    crate::diagnostics::native_event(
        "keychain_io_started",
        &[
            ("operation", operation),
            ("sequence", sequence),
            ("pid", std::process::id() as u64),
        ],
    );
    let result = action();
    crate::diagnostics::native_event(
        "keychain_io_finished",
        &[
            ("operation", operation),
            ("sequence", sequence),
            ("pid", std::process::id() as u64),
            ("duration_ms", started.elapsed().as_millis() as u64),
            ("success", u64::from(result.is_ok())),
        ],
    );
    result
}
