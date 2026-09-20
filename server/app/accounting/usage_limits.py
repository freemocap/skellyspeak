"""Daily usage enforcement, explicitly disabled only by the local launcher.

The flag is process-local, never read from request data, environment variables,
or editable admin policy. Normal Firestore clients always enforce limits.
"""


def enforced(db) -> bool:
    return getattr(db, "enforce_usage_limits", True) is not False
