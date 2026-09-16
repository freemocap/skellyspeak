"""Persistent, owner-only loopback development credentials; never packaged for hosting."""
from __future__ import annotations

import json
import os
from pathlib import Path
import secrets
import stat
import tempfile
import time

import jwt

LIFETIME_SECONDS = 10 * 365 * 24 * 60 * 60
INVALID = "Local session credentials are invalid. Run with --reset-session-token to replace them."


def read_private(path: Path) -> str:
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, encoding="utf-8") as file:
        info = os.fstat(file.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > 16384:
            raise RuntimeError(INVALID)
        os.fchmod(file.fileno(), 0o600)
        return file.read()


def write_private(path: Path, text: str) -> None:
    if path.is_symlink():
        raise RuntimeError("Local session files cannot be symlinks.")
    descriptor, temporary = tempfile.mkstemp(prefix=".session-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            os.fchmod(file.fileno(), 0o600)
            file.write(text)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load(directory: Path, *, reset: bool = False) -> tuple[str, str]:
    if any(path.is_symlink() for path in (directory, *directory.parents)):
        raise RuntimeError("Local session directory cannot use symlinks.")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)
    state_path = directory / "session.json"
    token_path = directory / "session-token.txt"
    if state_path.is_symlink() or token_path.is_symlink():
        raise RuntimeError("Local session files cannot be symlinks.")
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
