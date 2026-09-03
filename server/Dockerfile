# Pinned by digest. `python:3.12-slim` and `uv:latest` are moving tags resolved
# at build time, so the same commit could produce a different image tomorrow,
# and a compromised upstream tag would land here with nothing to notice it. The
# tag names are kept alongside for readability — the digest is what binds.
#
# To update, resolve the new digest deliberately rather than dropping the pin:
#   docker buildx imagetools inspect python:3.12-slim
FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea

COPY --from=ghcr.io/astral-sh/uv:latest@sha256:8b940d3a9d65bed080436972241af2e21c84b5e8c9193f7014ed71479ee795ff /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY *.py ./

# Not root. Cloud Run isolates the container, but a process that never needs to
# write to its own image should not be able to, and nothing here needs
# privilege to serve HTTP on 8080.
RUN useradd --system --uid 10001 --no-create-home app \
    && chown -R app:app /app
USER app

# The interpreter from the venv `uv sync` built, NOT `uv run`.
#
# `uv` is a build-time tool. Using it as the launcher makes it initialise a
# cache under $HOME on every cold start — which for a --no-create-home system
# user is a directory that does not exist and cannot be created, so the
# container exits(2) before it ever binds the port:
#
#   failed to create directory `/home/app/.cache/uv`: Permission denied
#
# Calling uvicorn directly needs no cache, no writable home, and no resolver
# work at startup.
CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
