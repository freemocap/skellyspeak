"""Private development files with explicit platform protection and link refusal."""
from __future__ import annotations

import os
from pathlib import Path
import stat
from uuid import uuid4


def reject_links(path: Path) -> None:
    if any(part.is_symlink() or part.is_junction() for part in (path, *path.parents)):
        raise RuntimeError('Private local files cannot use symlinks or junctions.')
    if path.is_file() and path.stat().st_nlink != 1:
        raise RuntimeError('Private local file must not have aliases.')


def private_directory(path: Path) -> None:
    reject_links(path)
    missing = []
    current = path
    while not current.exists():
        missing.append(current)
        current = current.parent
    if os.name == 'nt':
        from server.development.windows_files import directory
        for parent in reversed(missing):
            directory(parent, create=True)
        directory(path, create=False)
    else:
        for parent in reversed(missing):
            parent.mkdir(mode=0o700)
        if not path.is_dir():
            raise RuntimeError('Private local destination must be a directory.')
        path.chmod(0o700)


def _open(path: Path, *, reading: bool) -> int:
    reject_links(path)
    if os.name == 'nt':
        from server.development.windows_files import open_file
        return open_file(path, reading=reading)
    flags = os.O_RDONLY | os.O_NONBLOCK if reading else os.O_WRONLY | os.O_CREAT | os.O_EXCL
    descriptor = os.open(path, flags | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise RuntimeError('Private local file must be a regular file without aliases.')
        os.fchmod(descriptor, 0o600)
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def private_file(path: Path):
    return os.fdopen(_open(path, reading=False), 'a', encoding='utf-8')


def read_private(path: Path) -> str:
    with os.fdopen(_open(path, reading=True), encoding='utf-8') as file:
        if os.fstat(file.fileno()).st_size > 16384:
            raise RuntimeError('Local session credentials are too large.')
        return file.read()


def write_private(path: Path, text: str) -> None:
    reject_links(path)
    temporary = path.parent / f'.session-{uuid4().hex}'
    created = False
    try:
        with private_file(temporary) as file:
            created = True
            file.write(text)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if created and temporary.exists():
            temporary.unlink()
