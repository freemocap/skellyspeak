"""Small process-local Firestore substitute for the local development server.

Local application data is intentionally disposable. Production and tests keep
using the real Firestore client; the launcher installs this store before the
application modules are imported.
"""
from __future__ import annotations

from collections.abc import Callable, Iterator
from copy import deepcopy
from functools import wraps
from datetime import datetime, timezone
from threading import RLock
from typing import Any, TypeVar

from google.cloud import firestore

T = TypeVar("T")


class Snapshot:
    def __init__(self, data: dict[str, Any] | None, document_id: str = ""):
        self._data = data
        self.id = document_id

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict[str, Any] | None:
        return deepcopy(self._data) if self._data is not None else None

    def get(self, field: str) -> Any:
        if self._data is None or field not in self._data:
            raise KeyError(f"{field!r} is not contained in the data")
        return self._data[field]


class Document:
    def __init__(self, database: "Database", path: str):
        self.database = database
        self.path = path

    def get(self, transaction: "Transaction | None" = None) -> Snapshot:
        return Snapshot(self.database._records.get(self.path), self.path.rsplit("/", 1)[-1])

    def collection(self, name: str) -> "Collection":
        return Collection(self.database, f"{self.path}/{name}")

    def set(self, data: dict[str, Any], merge: bool = False) -> None:
        with self.database._lock:
            current = deepcopy(self.database._records.get(self.path, {})) if merge else {}
            for field, value in data.items():
                if isinstance(value, firestore.Increment):
                    current[field] = (current.get(field) or 0) + value.value
                elif value is firestore.SERVER_TIMESTAMP:
                    current[field] = datetime.now(timezone.utc)
                else:
                    current[field] = value
            self.database._records[self.path] = current


class Query:
    def __init__(self, database: "Database", path: str, *, maximum=None, order=None, descending=False, after=None):
        self.database, self.path = database, path
        self.maximum, self.order, self.descending, self.after = maximum, order, descending, after

    def _copy(self, **changes):
        return Query(self.database, self.path, **{**dict(maximum=self.maximum, order=self.order,
            descending=self.descending, after=self.after), **changes})

    def limit(self, count):
        return self._copy(maximum=count)

    def order_by(self, field, direction=None):
        return self._copy(order=field, descending=direction == firestore.Query.DESCENDING)

    def start_after(self, cursor):
        return self._copy(after=cursor['__name__'].path.rsplit('/', 1)[-1])

    def stream(self):
        return iter(self)

    def __iter__(self) -> Iterator[Snapshot]:
        prefix = f"{self.path}/"
        with self.database._lock:
            rows = [Snapshot(deepcopy(data), path[len(prefix):]) for path, data in self.database._records.items()
                    if path.startswith(prefix) and "/" not in path[len(prefix):]]
        if self.order == '__name__':
            rows.sort(key=lambda row: row.id, reverse=self.descending)
        elif self.order:
            rows = [row for row in rows if self.order in row._data]
            rows.sort(key=lambda row: row._data[self.order], reverse=self.descending)
        if self.after is not None:
            rows = [row for row in rows if row.id > self.after]
        yield from rows[:self.maximum]


class Collection(Query):
    def document(self, document_id: str) -> Document:
        return Document(self.database, f"{self.path}/{document_id}")

    def select(self, _fields: list[str]) -> Query:
        return Query(self.database, self.path)


class Transaction:
    def __init__(self, database: "Database"):
        self.database = database

    def get(self, reference: Document | Query) -> Snapshot | Iterator[Snapshot]:
        return iter(reference) if isinstance(reference, Query) else reference.get()

    def set(self, reference: Document, data: dict[str, Any], merge: bool = False) -> None:
        reference.set(data, merge=merge)

    def delete(self, reference: Document) -> None:
        self.database._records.pop(reference.path, None)


class Database:
    def __init__(self):
        self._records: dict[str, dict[str, Any]] = {}
        self._lock = RLock()

    def collection(self, name: str) -> Collection:
        return Collection(self, name)

    def transaction(self, *, max_attempts: int = 1) -> Transaction:
        del max_attempts
        return Transaction(self)


def transactional(function: Callable[[Transaction], T]) -> Callable[[Transaction], T]:
    """Run one local transaction atomically and roll it back on failure."""
    @wraps(function)
    def run(transaction: Transaction) -> T:
        database = transaction.database
        with database._lock:
            before = deepcopy(database._records)
            try:
                return function(transaction)
            except BaseException:
                database._records = before
                raise

    return run


def install() -> Database:
    """Install local factories before any hosted application module is imported."""
    database = Database()
    firestore.transactional = transactional  # type: ignore[assignment]
    # main.py constructs its database at import time. Replacing the constructor
    # prevents even an attempted Application Default Credentials/cloud lookup.
    firestore.Client = lambda *args, **kwargs: database  # type: ignore[misc,assignment]
    return database
