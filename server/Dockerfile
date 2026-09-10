# Runtime and build tools are pinned by digest.
FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea
COPY --from=ghcr.io/astral-sh/uv:latest@sha256:8b940d3a9d65bed080436972241af2e21c84b5e8c9193f7014ed71479ee795ff /uv /uvx /bin/
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends -y ffmpeg \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY main.py config.py auth.py auth_store.py admission.py work_admission.py grouped.py quota.py budget.py transactions.py contracts.py audio_input.py streaming.py observability.py diagnostics.py ./
RUN useradd --system --uid 10001 --no-create-home app \
    && chown -R app:app /app
USER app
# Launch the installed environment without resolving packages or creating a cache.
CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
