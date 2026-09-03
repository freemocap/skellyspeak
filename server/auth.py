"""Sign-in.

The app never holds an OAuth client secret. It opens the system browser at
`/auth/start`, this service performs the provider exchange, and the browser
comes back to the app with a short-lived one-time code. The app trades that
code for a session token over HTTPS.

Two decisions worth stating, because both are security-load-bearing:

1. The token is NOT put in the redirect URL. URLs land in browser history,
   server logs and referrer headers. A one-time code that must be exchanged
   over POST does not.

2. `redirect_uri` is checked against a strict allowlist. Anything else is an
   open redirect, which here means handing an attacker a way to receive other
   people's sign-in codes.

3. PKCE (RFC 7636) binds the code to the client that started the flow. A
   private-use scheme like `skellyspeak://` can be registered by ANY app on
   Android, so the redirect carrying the code is not a private channel. Without
   PKCE, an app that registers the same scheme intercepts the code and trades
   it for a 30-day session. With it, the interceptor also needs the verifier,
   which never leaves the device that generated it. RFC 8252 §8.1 requires this
   for native apps.
"""

from __future__ import annotations

import base64
import hashlib
import re
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import jwt

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

SESSION_TTL_SECONDS = 30 * 24 * 60 * 60  # 30 days
# Long enough to cover the browser handing control back to the app, short
# enough that a leaked code is worthless by the time anyone finds it.
LOGIN_CODE_TTL_SECONDS = 120

# RFC 8252: native apps redirect either to a loopback address on an ephemeral
# port, or to a private-use scheme. Both are allowed; nothing else is.
_LOOPBACK = re.compile(r"^http://(127\.0\.0\.1|\[::1\])(:\d{1,5})?/[A-Za-z0-9._~/-]*$")
_APP_SCHEME = re.compile(r"^skellyspeak://[A-Za-z0-9._~/-]*$")


class AuthError(Exception):
    """Sign-in could not be completed. The message reaches the user."""


def validate_redirect_uri(redirect_uri: str) -> str:
    """Accept only redirect targets that belong to this app.

    Without this the endpoint is an open redirect: an attacker sends a victim
    to a legitimate-looking sign-in link with their own redirect and collects
    the resulting code.
    """
    candidate = redirect_uri.strip()
    if _LOOPBACK.match(candidate) or _APP_SCHEME.match(candidate):
        return candidate
    raise AuthError(
        "Unrecognised redirect target. Sign-in only returns to SkellySpeak "
        "running on this device."
    )


def google_authorize_url(*, client_id: str, redirect_uri: str, state: str) -> str:
    """Where the system browser is sent to begin Google sign-in."""
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            # We only need identity, so ask for consent once and never request
            # offline access — this service holds no Google refresh tokens.
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    return f"{GOOGLE_AUTH_URL}?{query}"


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str
    email: str
    email_verified: bool
    name: str
    picture: str

    @property
    def user_id(self) -> str:
        """Stable per-provider id. Namespaced so a future provider with the
        same numeric subject can never collide with a Google account."""
        return f"google:{self.subject}"


def parse_google_id_token(id_token: str, *, client_id: str, jwks_client) -> GoogleIdentity:
    """Verify Google's ID token and extract who signed in.

    Signature, audience, issuer and expiry are all checked. An unverified
    token is worthless — anyone can mint a JSON blob claiming to be someone.
    """
    signing_key = jwks_client.get_signing_key_from_jwt(id_token).key
    claims = jwt.decode(
        id_token,
        signing_key,
        algorithms=["RS256"],
        audience=client_id,
        options={"require": ["exp", "iat", "aud", "iss", "sub"]},
    )
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise AuthError(f"Unexpected token issuer: {claims.get('iss')!r}")
    email = claims.get("email", "")
    if not claims.get("email_verified", False):
        raise AuthError(
            "This Google account has no verified email address, so it cannot "
            "be used to sign in."
        )
    return GoogleIdentity(
        subject=str(claims["sub"]),
        email=email,
        email_verified=True,
        name=claims.get("name", ""),
        picture=claims.get("picture", ""),
    )


def issue_session_token(
    *, user_id: str, signing_key: str, token_version: int = 0, now: int | None = None
) -> str:
    """Mint the bearer token the app sends with every proxied request.

    `tv` is the account's token version at the moment of signing. Bumping it on
    the user document invalidates every session issued before — the per-account
    revocation lever, since a JWT is otherwise good for its full 30 days no
    matter what happens to the account behind it.
    """
    issued = int(time.time()) if now is None else now
    return jwt.encode(
        {
            "sub": user_id,
            "tv": int(token_version),
            "iat": issued,
            "exp": issued + SESSION_TTL_SECONDS,
            "iss": "skellyspeak-api",
        },
        signing_key,
        algorithm="HS256",
    )


def read_session_token(token: str, *, signing_key: str) -> tuple[str, int]:
    """Return the user id and token version a session attests to, or raise."""
    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["HS256"],
            issuer="skellyspeak-api",
            options={"require": ["exp", "iat", "sub", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Your session has expired. Sign in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("Your session is not valid. Sign in again.") from exc
    # Tokens minted before revocation existed carry no `tv`; they read as 0,
    # which is the version every account starts at.
    return str(claims["sub"]), int(claims.get("tv") or 0)


def new_login_code() -> str:
    """One-time code handed to the app through the browser redirect."""
    return secrets.token_urlsafe(32)


def new_state() -> str:
    """CSRF guard for the provider round trip."""
    return secrets.token_urlsafe(24)


# ── PKCE (RFC 7636) ─────────────────────────────────────────────────────────

# The verifier is 43-128 characters of unreserved ASCII per RFC 7636 §4.1.
_VERIFIER = re.compile(r"^[A-Za-z0-9._~-]{43,128}$")
# S256 only. RFC 8252 §8.1: "plain" offers no protection against an attacker
# who can see the challenge, which is exactly the attacker PKCE exists for.
CHALLENGE_METHOD = "S256"


def s256_challenge(verifier: str) -> str:
    """The challenge a client derives from its verifier."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def validate_challenge(code_challenge: str, method: str) -> str:
    """Accept a well-formed S256 challenge, and nothing else."""
    if method != CHALLENGE_METHOD:
        raise AuthError(
            f"Unsupported code_challenge_method {method!r}. Only S256 is accepted."
        )
    candidate = code_challenge.strip()
    # A base64url SHA-256 digest is always 43 characters.
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", candidate):
        raise AuthError("Malformed code_challenge.")
    return candidate


def verify_code_verifier(verifier: str, *, challenge: str) -> None:
    """Prove this client is the one that started the sign-in.

    Compared in constant time: a leaky comparison here would let an attacker
    who can retry recover the challenge one character at a time.
    """
    candidate = verifier.strip()
    if not _VERIFIER.match(candidate):
        raise AuthError("Malformed code_verifier.")
    if not secrets.compare_digest(s256_challenge(candidate), challenge):
        raise AuthError(
            "This sign-in did not come from the app that started it. Sign in again."
        )


def new_code_verifier() -> str:
    """A verifier, for tests and for any client written in Python."""
    return secrets.token_urlsafe(64)[:128]
