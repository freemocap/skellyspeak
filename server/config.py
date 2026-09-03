"""Runtime configuration, read once at import.

Every value is required. A missing one raises at startup rather than at the
first request that needs it: a service that boots healthy and then fails auth
for every user is far worse to diagnose than one that refuses to boot.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigError(RuntimeError):
    """A required setting is missing or unusable."""


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(
            f"{name} is not set. Cloud Run reads it from Secret Manager; "
            f"locally, put it in server/.env."
        )
    return value


# RFC 7518 §3.2: an HMAC-SHA256 key shorter than the hash output weakens the
# signature. A guessable session-signing key means forgeable sessions.
MIN_SIGNING_KEY_BYTES = 32


def _required_secret(name: str, *, min_bytes: int) -> str:
    value = _required(name)
    if len(value.encode()) < min_bytes:
        raise ConfigError(
            f"{name} is only {len(value.encode())} bytes; at least {min_bytes} are "
            f"required. Generate one with: openssl rand -base64 48"
        )
    return value


def _required_int(name: str) -> int:
    raw = _required(name)
    try:
        return int(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} must be an integer, got {raw!r}") from exc


def _required_list(name: str) -> tuple[str, ...]:
    """A comma-separated allowlist. Empty entries are dropped; empty is refused.

    An allowlist that silently ends up empty is an allowlist that permits
    nothing or — far worse, if a later reader treats empty as "unset" —
    everything.
    """
    items = tuple(part.strip() for part in _required(name).split(",") if part.strip())
    if not items:
        raise ConfigError(f"{name} contains no entries.")
    return items


@dataclass(frozen=True)
class Config:
    # ── Identity ────────────────────────────────────────────────────────────
    google_client_id: str
    google_client_secret: str
    # Signs the session tokens this service issues. Rotating it logs everyone
    # out, which is the intended emergency lever.
    jwt_signing_key: str
    # Public https base of this service, used to build the OAuth redirect that
    # providers must match exactly.
    public_base_url: str

    # ── Upstream AI ─────────────────────────────────────────────────────────
    openrouter_key: str
    openrouter_base_url: str
    # Speech-to-text. Hosted users must not need a second key of their own.
    groq_key: str
    groq_base_url: str

    # Which models this service will pay for. The request body is otherwise
    # forwarded untouched, so without this the caller chooses what we are
    # billed for — and prices across OpenRouter differ by two orders of
    # magnitude. The app needs exactly one model to work; anything else is a
    # misconfiguration, not a feature.
    allowed_models: tuple[str, ...]
    # Refuses a request that asks for more than this many completion tokens.
    # One runaway generation should not be able to spend a whole day's budget.
    max_completion_tokens: int

    # ── Limits, in micro-dollars ────────────────────────────────────────────
    # Money, not tokens. OpenRouter reports `usage.cost` per request, so this
    # meters what was actually charged rather than a token count whose price
    # the caller controls by choosing a model.
    #
    # Micro-dollars (1_000_000 = $1) because Firestore counters must be
    # integers to increment atomically, and float dollars would drift.
    free_daily_micros: int
    # Across all users, per UTC day. The kill switch: per-user limits cap what
    # one person can spend, not what a launch-day crowd can.
    global_daily_micros: int
    # How many accounts may exist at all.
    max_users: int

    @property
    def google_redirect_uri(self) -> str:
        return f"{self.public_base_url.rstrip('/')}/auth/callback/google"


def load() -> Config:
    return Config(
        google_client_id=_required("GOOGLE_CLIENT_ID"),
        google_client_secret=_required("GOOGLE_CLIENT_SECRET"),
        jwt_signing_key=_required_secret("JWT_SIGNING_KEY", min_bytes=MIN_SIGNING_KEY_BYTES),
        public_base_url=_required("PUBLIC_BASE_URL"),
        openrouter_key=_required("OPENROUTER_API_KEY"),
        openrouter_base_url=os.environ.get(
            "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
        ).rstrip("/"),
        groq_key=_required("GROQ_API_KEY"),
        groq_base_url=os.environ.get(
            "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
        ).rstrip("/"),
        allowed_models=_required_list("ALLOWED_MODELS"),
        max_completion_tokens=_required_int("MAX_COMPLETION_TOKENS"),
        free_daily_micros=_required_int("FREE_DAILY_MICROS"),
        global_daily_micros=_required_int("GLOBAL_DAILY_MICROS"),
        max_users=_required_int("MAX_USERS"),
    )
