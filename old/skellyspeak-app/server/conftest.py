"""Test environment.

`main.py` reads its configuration at import — deliberately, so a missing
setting refuses to boot rather than failing on the first request that needs it.
That means importing it in a test needs the settings present, so they are put
here, before pytest collects anything.

Every value is obviously fake. `FIRESTORE_EMULATOR_HOST` is what stops the
Firestore client demanding credentials at construction; nothing ever connects
to it.
"""

from __future__ import annotations

import os

_FAKE_ENV = {
    "GOOGLE_CLIENT_ID": "test-client-id",
    "GOOGLE_CLIENT_SECRET": "test-client-secret",
    # 40 bytes: over the 32-byte floor config.py enforces.
    "JWT_SIGNING_KEY": "test-signing-key-not-real-but-long-enough",
    "PUBLIC_BASE_URL": "https://test.invalid",
    "OPENROUTER_API_KEY": "test-openrouter-key",
    "GROQ_API_KEY": "test-groq-key",
    "ALLOWED_MODELS": "google/gemini-2.5-flash,openai/gpt-audio-mini",
    "MAX_COMPLETION_TOKENS": "32768",
    "FREE_DAILY_MICROS": "500000",
    "GLOBAL_DAILY_MICROS": "2000000",
    "MAX_USERS": "6",
    "GOOGLE_CLOUD_PROJECT": "test-project",
    "FIRESTORE_EMULATOR_HOST": "127.0.0.1:9999",
}

for key, value in _FAKE_ENV.items():
    os.environ.setdefault(key, value)
