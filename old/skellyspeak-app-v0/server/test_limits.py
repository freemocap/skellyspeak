"""Request bodies must never be read without a ceiling.

`await request.body()` buffers the whole thing in memory before anything can
inspect it, so a size check placed afterwards runs when the damage is already
done — on a 512Mi Cloud Run instance, after the process died.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

import main


class FakeRequest:
    """Just enough of Starlette's Request: headers and a chunked stream."""

    def __init__(self, chunks: list[bytes], content_length: str | None):
        self._chunks = chunks
        self.headers = {} if content_length is None else {"content-length": content_length}

    async def stream(self):
        for chunk in self._chunks:
            yield chunk


def read(chunks: list[bytes], limit: int, content_length: str | None = None) -> bytes:
    return asyncio.run(
        main.read_capped_body(FakeRequest(chunks, content_length), limit, "That request")
    )


class TestBodyCap:
    def test_a_body_within_the_limit_comes_back_whole(self):
        assert read([b"abc", b"def"], 100, "6") == b"abcdef"

    def test_no_content_length_is_fine(self):
        # Chunked uploads legitimately omit it.
        assert read([b"hello"], 100, None) == b"hello"

    def test_an_honest_oversized_body_is_refused_before_it_is_read(self):
        with pytest.raises(HTTPException) as exc:
            read([], 1_048_576, str(50 * 1_048_576))
        assert exc.value.status_code == 413

    def test_a_lying_content_length_does_not_get_past_the_cap(self):
        # The whole reason the running total is checked as well: a client that
        # declares 10 bytes and sends 10MB must still be stopped, and stopped
        # while it is arriving rather than afterwards.
        with pytest.raises(HTTPException) as exc:
            read([b"x" * 100] * 50, 1_000, "10")
        assert exc.value.status_code == 413

    def test_a_missing_content_length_does_not_get_past_the_cap(self):
        with pytest.raises(HTTPException) as exc:
            read([b"x" * 100] * 50, 1_000, None)
        assert exc.value.status_code == 413

    def test_a_malformed_content_length_is_a_bad_request(self):
        with pytest.raises(HTTPException) as exc:
            read([b"x"], 1_000, "not-a-number")
        assert exc.value.status_code == 400

    def test_exactly_at_the_limit_is_allowed(self):
        assert read([b"x" * 100], 100, "100") == b"x" * 100

    def test_one_byte_over_is_not(self):
        with pytest.raises(HTTPException):
            read([b"x" * 101], 100, None)


class TestTheLimitsThemselves:
    def test_chat_bodies_are_capped_far_below_the_instance_memory(self):
        # A conversation payload is kilobytes. The cap exists to stop a body
        # that is not one, and must stay well under the 512Mi instance.
        assert main.MAX_JSON_BYTES == 1 * 1024 * 1024

    def test_audio_matches_what_the_upstream_accepts(self):
        # Groq's own limit for a transcription upload.
        assert main.MAX_AUDIO_BYTES == 25 * 1024 * 1024
