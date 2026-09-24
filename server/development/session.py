"""Persistent, owner-only loopback development credentials; never packaged for hosting."""
from __future__ import annotations

import json
from pathlib import Path
import secrets
import time

import jwt
from server.development.private_files import private_directory, read_private, reject_links, write_private

LIFETIME_SECONDS = 10 * 365 * 24 * 60 * 60
INVALID = "Local session credentials are invalid. Run with --reset-session-token to replace them."


def load(directory: Path, *, reset: bool = False) -> tuple[str, str]:
    private_directory(directory)
    state_path = directory / "session.json"
    token_path = directory / "session-token.txt"
    reject_links(state_path)
    reject_links(token_path)
    if reset or not state_path.exists():
        signing_key = secrets.token_urlsafe(48)
        issued = int(time.time())
        token = jwt.encode({"sub": "local-learner", "tv": 0, "iat": issued,
                            "exp": issued + LIFETIME_SECONDS, "iss": "skellyspeak-api"},
                           signing_key, algorithm="HS256")
        # Commit the key/token together. The human-readable token file is a mirror
        # that can be repaired after interruption without rotating credentials.
        write_private(state_path, json.dumps({"version": 1, "signing_key": signing_key, "token": token}) + "\n")
    else:
        try:
            state = json.loads(read_private(state_path))
            if not isinstance(state, dict) or state.get("version") != 1:
                raise ValueError()
            signing_key, token = state["signing_key"], state["token"]
            if not isinstance(signing_key, str) or len(signing_key) != 64 or not isinstance(token, str):
                raise ValueError()
            claims = jwt.decode(token, signing_key, algorithms=["HS256"], issuer="skellyspeak-api",
                                options={"require": ["sub", "tv", "iat", "exp", "iss"]})
            if claims["sub"] != "local-learner" or type(claims["tv"]) is not int or claims["tv"] != 0:
                raise ValueError()
        except (ValueError, KeyError, TypeError, jwt.InvalidTokenError) as error:
            raise RuntimeError(INVALID) from error
    write_private(token_path, token + "\n")
    return signing_key, token
