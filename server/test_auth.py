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
            # The loopback PORT is the only part that may vary: RFC 8252
            # requires it to be ephemeral, so it cannot be pre-registered.
            "http://127.0.0.1/callback",
            "http://127.0.0.1:1420/callback",
            "http://127.0.0.1:53127/callback",
            "http://[::1]:8080/callback",
            "skellyspeak://auth",
            "skellyspeak://auth/",
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
            # RFC 9700 wants exact matching, so a path the app never uses is
            # refused even on the right host. Every extra accepted path is
            # another place an authorization code could be delivered.
            "http://127.0.0.1:53127/auth/callback",
            "http://127.0.0.1:53127/",
            "http://127.0.0.1:53127/callback/../evil",
            "http://127.0.0.1:53127/callback?next=https://evil.example",
            "http://127.0.0.1:53127/callback#fragment",
            "skellyspeak://auth/callback",
            "skellyspeak://evil",
            "skellyspeak://auth/../evil",
        ],
    )
    def test_rejects_everything_else(self, uri):
        with pytest.raises(auth.AuthError):
            auth.validate_redirect_uri(uri)


class TestSessionTokens:
    KEY = "test-signing-key-not-a-real-one-but-long-enough-for-hs256"

    def test_round_trips_the_user_id(self):
        token = auth.issue_session_token(user_id="google:123", signing_key=self.KEY)
        assert auth.read_session_token(token, signing_key=self.KEY) == ("google:123", 0)

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


class TestRedirectAssembly:
    """`app_state` is caller-supplied and is interpolated into the app's own
    redirect. Unencoded, a "&" or "#" in it becomes a parameter of its own."""

    @staticmethod
    def build(redirect: str, app_state: str, code: str) -> str:
        """The assembly performed in main.auth_callback_google."""
        from urllib.parse import quote

        joiner = "&" if "?" in redirect else "?"
        passthrough = f"&state={quote(str(app_state), safe='')}" if app_state else ""
        return f"{redirect}{joiner}code={code}{passthrough}"

    @pytest.mark.parametrize(
        "hostile",
        [
            "x&code=attacker-code",
            "x#fragment",
            "x&redirect_uri=https://evil.example",
            "x?a=b",
            "../../etc/passwd",
        ],
    )
    def test_app_state_cannot_inject_parameters(self, hostile):
        from urllib.parse import parse_qs, urlparse

        url = self.build("http://127.0.0.1:1420/callback", hostile, "real-code")
        query = parse_qs(urlparse(url).query)
        # Exactly the two parameters we intended, and `code` is still ours.
        assert set(query) == {"code", "state"}
        assert query["code"] == ["real-code"]
        # The hostile value survives intact as data, having been decoded once.
        assert query["state"] == [hostile]
        assert "#" not in url

    def test_an_absent_app_state_adds_no_parameter(self):
        url = self.build("skellyspeak://auth", "", "real-code")
        assert url == "skellyspeak://auth?code=real-code"


class TestPKCE:
    """The redirect carrying the login code is not a private channel.

    On Android any app may register `skellyspeak://`, so an app that does can
    receive the code. PKCE (RFC 7636) is what stops that code being worth
    anything without the verifier, which never leaves the device that made it.
    RFC 8252 §8.1 requires this for native apps.
    """

    def test_the_matching_verifier_is_accepted(self):
        verifier = auth.new_code_verifier()
        challenge = auth.s256_challenge(verifier)
        auth.verify_code_verifier(verifier, challenge=challenge)  # no raise

    def test_an_intercepted_code_is_useless_without_the_verifier(self):
        # The attacker has the challenge (it went over the wire) and the code,
        # and still cannot complete the exchange.
        challenge = auth.s256_challenge(auth.new_code_verifier())
        with pytest.raises(auth.AuthError):
            auth.verify_code_verifier(auth.new_code_verifier(), challenge=challenge)

    def test_the_challenge_is_not_the_verifier(self):
        # Sending the challenge back as if it were the verifier must fail, or
        # PKCE degrades to "echo the value you were given".
        verifier = auth.new_code_verifier()
        challenge = auth.s256_challenge(verifier)
        with pytest.raises(auth.AuthError):
            auth.verify_code_verifier(challenge, challenge=challenge)

    def test_the_challenge_is_base64url_sha256_with_no_padding(self):
        # RFC 7636 §4.2. Padding or standard base64 would not interoperate.
        challenge = auth.s256_challenge("a" * 43)
        assert "=" not in challenge
        assert "+" not in challenge and "/" not in challenge
        assert len(challenge) == 43

    def test_a_known_vector_matches_the_rfc(self):
        # RFC 7636 Appendix B.
        verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        assert auth.s256_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

    def test_only_s256_is_accepted(self):
        challenge = auth.s256_challenge(auth.new_code_verifier())
        auth.validate_challenge(challenge, "S256")  # no raise
        # "plain" offers no protection against an attacker who can see the
        # challenge, which is exactly the attacker this defends against.
        with pytest.raises(auth.AuthError):
            auth.validate_challenge(challenge, "plain")

    def test_a_malformed_challenge_is_refused(self):
        for bad in ["", "short", "!" * 43, "A" * 42, "A" * 44]:
            with pytest.raises(auth.AuthError):
                auth.validate_challenge(bad, "S256")

    def test_a_verifier_outside_the_rfc_length_is_refused(self):
        challenge = auth.s256_challenge("x" * 43)
        for bad in ["x" * 42, "x" * 129, "", "has spaces in it" + "x" * 30]:
            with pytest.raises(auth.AuthError):
                auth.verify_code_verifier(bad, challenge=challenge)

    def test_a_generated_verifier_satisfies_the_rfc_length(self):
        for _ in range(20):
            assert 43 <= len(auth.new_code_verifier()) <= 128


class TestSessionRevocationClaim:
    def test_the_token_carries_the_account_version(self):
        token = auth.issue_session_token(
            user_id="google:1", signing_key="k" * 32, token_version=7
        )
        assert auth.read_session_token(token, signing_key="k" * 32) == ("google:1", 7)

    def test_a_token_without_a_version_reads_as_zero(self):
        # Tokens minted before revocation existed carry no `tv`. They must read
        # as version 0 — the version every account starts at — not crash.
        import jwt as _jwt
        import time as _time

        legacy = _jwt.encode(
            {
                "sub": "google:1",
                "iat": int(_time.time()),
                "exp": int(_time.time()) + 60,
                "iss": "skellyspeak-api",
            },
            "k" * 32,
            algorithm="HS256",
        )
        assert auth.read_session_token(legacy, signing_key="k" * 32) == ("google:1", 0)
