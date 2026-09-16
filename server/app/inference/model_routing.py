"""Model recommendations and reservation estimates; never provider routing rules."""
from __future__ import annotations

FLASH = "google/gemini-2.5-flash"
LITE = "google/gemini-2.5-flash-lite"
OSS = "openai/gpt-oss-120b"
RECOMMENDED_TEXT_MODELS = (FLASH, LITE, OSS)
# Reservation estimates do not constrain provider selection or actual charges.
DEFAULT_TEXT_RESERVATION_RATE = (0.3, 2.5)
# USD per million tokens, numerically equal to microdollars per token.
# [@groqModels20260913] [@openrouterGeminiLite20260913]
PRICES = {FLASH: (0.3, 2.5), LITE: (0.1, 0.4), OSS: (0.15, 0.6)}
