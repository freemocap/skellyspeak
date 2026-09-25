# Runtime and build tools are pinned by digest.
FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea
COPY --from=ghcr.io/astral-sh/uv:latest@sha256:8b940d3a9d65bed080436972241af2e21c84b5e8c9193f7014ed71479ee795ff /uv /uvx /bin/
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends -y ffmpeg \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY __init__.py ./server/
COPY app/main.py app/config.py app/transactions.py app/__init__.py ./server/app/
COPY app/identity/auth.py app/identity/auth_store.py app/identity/__init__.py ./server/app/identity/
COPY app/admission/admission.py app/admission/work_admission.py app/admission/__init__.py ./server/app/admission/
COPY app/inference/retry.py app/inference/decisions.py app/inference/audio_service.py app/inference/audio_contracts.py app/inference/elevenlabs.py app/inference/groq_transcription.py app/inference/transcription_profiles.py app/inference/transcription_timing.py app/inference/synthesis_alignment.py app/inference/grouped.py app/inference/model_routing.py app/inference/contracts.py app/inference/audio_input.py app/inference/streaming.py app/inference/__init__.py ./server/app/inference/
COPY app/accounting/usage_limits.py app/accounting/quota.py app/accounting/budget.py app/accounting/__init__.py ./server/app/accounting/
COPY app/diagnostics/policy.py app/diagnostics/exceptions.py app/diagnostics/provider_health.py app/diagnostics/provider_errors.py app/diagnostics/runtime.py app/diagnostics/observability.py app/diagnostics/diagnostics.py app/diagnostics/__init__.py ./server/app/diagnostics/
COPY app/identity/admin_auth.py ./server/app/identity/
COPY app/inference/transcription_confidence.py ./server/app/inference/
COPY app/accounting/admin_controls.py ./server/app/accounting/
COPY app/diagnostics/admin_events.py app/diagnostics/admin_live.py ./server/app/diagnostics/
COPY app/diagnostics/admin_routes.py ./server/app/diagnostics/
COPY app/diagnostics/admin_reports.py ./server/app/diagnostics/
COPY app/diagnostics/admin_logs.py ./server/app/diagnostics/
COPY app/diagnostics/admin_assets/index.html app/diagnostics/admin_assets/admin.css app/diagnostics/admin_assets/admin.js ./server/app/diagnostics/admin_assets/
RUN useradd --system --uid 10001 --no-create-home app \
    && chown -R app:app /app
USER app
# Launch the installed environment without resolving packages or creating a cache.
CMD ["/app/.venv/bin/uvicorn", "server.app.main:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
