from pathlib import Path
import stat

import pytest

from server.app.identity.auth import AuthError, read_session_token
from server.development import session


def test_restarts_keep_key_and_token_and_reset_revokes_old_token(tmp_path: Path):
    directory = tmp_path.resolve() / 'local'
    first = session.load(directory)
    assert session.load(directory) == first
    assert read_session_token(first[1], signing_key=first[0]) == ('local-learner', 0)
    assert (directory / 'session-token.txt').read_text().strip() == first[1]
    assert stat.S_IMODE(directory.stat().st_mode) == 0o700
    for path in directory.iterdir():
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
    second = session.load(directory, reset=True)
    assert second != first
    with pytest.raises(AuthError):
        read_session_token(first[1], signing_key=second[0])
    assert session.load(directory) == second


def test_missing_token_mirror_is_repaired_without_rotation(tmp_path):
    directory = tmp_path.resolve() / 'local'
    first = session.load(directory)
    (directory / 'session-token.txt').unlink()
    assert session.load(directory) == first
    assert (directory / 'session-token.txt').read_text().strip() == first[1]


def test_corruption_fails_explicitly_without_silent_rotation(tmp_path):
    directory = tmp_path.resolve() / 'local'
    session.load(directory)
    state = directory / 'session.json'
    state.write_text('private invalid state')
    with pytest.raises(RuntimeError, match='--reset-session-token') as error:
        session.load(directory)
    assert 'private' not in str(error.value)
    assert state.read_text() == 'private invalid state'
    session.load(directory, reset=True)


@pytest.mark.parametrize('name', ['session.json', 'session-token.txt'])
def test_symlink_files_are_rejected_even_on_explicit_reset(tmp_path, name):
    directory = tmp_path.resolve() / 'local'
    directory.mkdir()
    target = tmp_path / 'unrelated'
    target.write_text('untouched')
    (directory / name).symlink_to(target)
    with pytest.raises(RuntimeError, match='symlink'):
        session.load(directory, reset=True)
    assert target.read_text() == 'untouched'


def test_local_lifetime_does_not_change_hosted_expiry(tmp_path):
    import jwt
    from server.app.identity import auth
    key, token = session.load(tmp_path.resolve() / 'local')
    claims = jwt.decode(token, key, algorithms=['HS256'])
    assert claims['exp'] - claims['iat'] == session.LIFETIME_SECONDS
    assert auth.SESSION_TTL_SECONDS == 30 * 24 * 60 * 60
