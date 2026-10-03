"""Client response content is not a diagnostic log: preserve it, remove secrets.

Only bounded JSON from fixed provider destinations reaches this boundary. Unknown
response fields are client-only data, never trusted logging fields or headers.
Oversize/deep responses fail explicitly rather than losing arbitrary fields.
"""
import json

from server.app.diagnostics.provider_errors import secret_field
from server.app.diagnostics.exceptions import DiagnosticValueError


def for_client(value, secrets=(), *, limit=4 * 1024 * 1024):
    secrets = tuple(secret for secret in secrets if secret)
    def clean(node, depth=0):
        if depth > 64:
            raise DiagnosticValueError('Provider response nesting exceeds relay limit.')
        if isinstance(node, dict):
            result = {}
            for key, item in node.items():
                safe_key = clean(key, depth + 1)
                if safe_key in result:
                    raise DiagnosticValueError('Provider response keys collide after credential redaction.')
                result[safe_key] = '[secret redacted]' if secret_field(key) else clean(item, depth + 1)
            return result
        if isinstance(node, list):
            return [clean(item, depth + 1) for item in node]
        if isinstance(node, str):
            for secret in secrets:
                node = node.replace(secret, '[secret redacted]')
        return node
    result = clean(value)
    if len(json.dumps(result, ensure_ascii=True, allow_nan=False).encode()) > limit:
        raise DiagnosticValueError('Provider response exceeds relay limit.')
    return result
