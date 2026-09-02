"""The parts of sign-in where a mistake is a vulnerability, not a bug."""

import time

import pytest

import auth


class TestRedirectAllowlist:
    """An unvalidated redirect_uri is an open redirect, and here that means
    handing an attacker other people's sign-in codes."""

    @pytest.mark.parametrize(
        "uri",
        [
            "http://127.0.0.1/callback",
            "http://127.0.0.1:1420/callback",
            "http://127.0.0.1:53127/auth/callback",
            "http://[::1]:8080/callback",
            "skellyspeak://auth/callback",
        ],
    )
    def test_accepts_this_app_on_this_device(self, uri):
        assert auth.validate_redirect_uri(uri) == uri

    @pytest.mark.parametrize(
        "uri",
        [
            "https://evil.example/steal",
            "http://evil.example/callback",
            # Host that merely starts with the loopback address.
            "http://127.0.0.1.evil.example/callback",
            # Credentials trick pointing at another host.
            "http://127.0.0.1@evil.example/callback",
            "skellyspeak-evil://auth",
            "javascript:alert(1)",
            "//evil.example",
            "",
        ],
    )
    def test_rejects_everything_else(self, uri):
        with pytest.raises(auth.AuthError):
            auth.validate_redirect_uri(uri)


class TestSessionTokens:
    KEY = "test-signing-key-not-a-real-one-but-long-enough-for-hs256"

    def test_round_trips_the_user_id(self):
        token = auth.issue_session_token(user_id="google:123", signing_key=self.KEY)
        assert auth.read_session_token(token, signing_key=self.KEY) == "google:123"

    def test_rejects_a_token_signed_with_another_key(self):
        token = auth.issue_session_token(user_id="google:123", signing_key="a-different-key-also-long-enough-for-hs256-abcdef")
        with pytest.raises(auth.AuthError):
            auth.read_session_token(token, signing_key=self.KEY)

    def test_rejects_an_expired_token(self):
        long_ago = int(time.time()) - auth.SESSION_TTL_SECONDS - 60
        token = auth.issue_session_token(
            user_id="google:123", signing_key=self.KEY, now=long_ago
        )
        with pytest.raises(auth.AuthError):
            auth.read_session_token(token, signing_key=self.KEY)

    def test_rejects_unsigned_garbage(self):
        for bad in ["", "not-a-token", "a.b.c"]:
            with pytest.raises(auth.AuthError):
                auth.read_session_token(bad, signing_key=self.KEY)


def test_codes_are_unguessable_and_unique():
    codes = {auth.new_login_code() for _ in range(200)}
    assert len(codes) == 200
    assert all(len(c) >= 32 for c in codes)


def test_a_weak_signing_key_is_refused_at_startup(monkeypatch):
    """A short HMAC key means forgeable sessions, so the service must not boot."""
    import config

    monkeypatch.setenv("_TEST_KEY", "tooshort")
    with pytest.raises(config.ConfigError, match="at least 32"):
        config._required_secret("_TEST_KEY", min_bytes=32)

    monkeypatch.setenv("_TEST_KEY", "x" * 32)
    assert config._required_secret("_TEST_KEY", min_bytes=32) == "x" * 32
