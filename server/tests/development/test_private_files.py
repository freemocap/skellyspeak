"""Private writes preserve the previous credential when replacement fails."""
import pytest

from server.development import private_files
from server.tests.development.file_assertions import assert_private, file_link


def test_failed_replacement_preserves_credentials_and_removes_temporary(tmp_path, monkeypatch):
    path = tmp_path / 'credential'
    private_files.write_private(path, 'previous')

    def fail(*args):
        raise PermissionError('replacement denied')

    monkeypatch.setattr(private_files.os, 'replace', fail)
    with pytest.raises(PermissionError, match='replacement denied'):
        private_files.write_private(path, 'replacement')
    assert private_files.read_private(path) == 'previous'
    assert list(tmp_path.iterdir()) == [path]
    assert_private(path)


def test_linked_credentials_are_not_read_or_replaced(tmp_path):
    target = tmp_path / 'target'
    target.write_text('original')
    link = tmp_path / 'credential'
    file_link(link, target)
    with pytest.raises(RuntimeError, match='symlink|aliases'):
        private_files.read_private(link)
    with pytest.raises(RuntimeError, match='symlink|aliases'):
        private_files.write_private(link, 'replacement')
    assert target.read_text() == 'original'


def test_oversized_credentials_are_rejected(tmp_path):
    path = tmp_path / 'credential'
    private_files.write_private(path, 'x' * 16385)
    with pytest.raises(RuntimeError, match='too large'):
        private_files.read_private(path)
