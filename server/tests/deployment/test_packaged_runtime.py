"""Boot only Docker COPY inputs; repository imports must not hide missing files."""
import os
from pathlib import Path
import shutil
import subprocess
import sys


def test_packaged_runtime_imports_and_serves_without_repository_sources(tmp_path):
    root = Path(__file__).parents[2]
    for line in (root / 'Dockerfile').read_text().splitlines():
        if not line.startswith('COPY ') or '--from=' in line:
            continue
        *sources, destination = line.split()[1:]
        target = tmp_path / destination
        target.mkdir(parents=True, exist_ok=True)
        for source in sources:
            shutil.copy2(root / source, target / Path(source).name)
    environment = {**os.environ, 'GOOGLE_CLIENT_ID': 'ci', 'GOOGLE_CLIENT_SECRET': 'ci',
                   'JWT_SIGNING_KEY': '0123456789012345678901234567890123456789',
                   'PUBLIC_BASE_URL': 'https://example.invalid', 'OPENROUTER_API_KEY': 'ci',
                   'GROQ_API_KEY': 'ci', 'MAX_COMPLETION_TOKENS': '32768',
                   'FREE_DAILY_MICROS': '500000', 'GLOBAL_DAILY_MICROS': '2000000',
                   'MAX_USERS': '6', 'GOOGLE_CLOUD_PROJECT': 'ci',
                   'FIRESTORE_EMULATOR_HOST': '127.0.0.1:9999'}
    script = '''
import sys
sys.path.insert(0, sys.argv[1])
from fastapi.testclient import TestClient
from server.app.main import app
with TestClient(app) as client:
    assert client.get('/health').status_code == 200
    for path in ['/v1/me', '/v1/diagnostics', '/v1/protocol']:
        assert client.get(path).status_code == 401, path
    for path in ['/v1/operations', '/v1/audio/speech', '/v1/audio/transcriptions']:
        assert client.post(path).status_code == 401, path
'''
    result = subprocess.run([sys.executable, '-I', '-c', script, str(tmp_path)],
                            cwd=tmp_path, env=environment, capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stdout + result.stderr
