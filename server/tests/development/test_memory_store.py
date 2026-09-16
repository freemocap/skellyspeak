"""The local store supplies the Firestore subset used by the API."""
from __future__ import annotations

import pytest
from google.cloud import firestore

from server.development import memory_store


def test_transactions_are_atomic_and_support_increment_and_delete() -> None:
    database = memory_store.Database()
    document = database.collection("items").document("one")
    document.set({"count": 1})

    @memory_store.transactional
    def fail(transaction: memory_store.Transaction) -> None:
        transaction.set(document, {"count": firestore.Increment(2)}, merge=True)
        raise RuntimeError("stop")

    with pytest.raises(RuntimeError, match="stop"):
        fail(database.transaction())
    assert document.get().to_dict() == {"count": 1}

    @memory_store.transactional
    def remove(transaction: memory_store.Transaction) -> None:
        transaction.delete(document)

    remove(database.transaction())
    assert not document.get().exists


def test_install_prevents_cloud_client_construction(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(firestore, "Client", lambda: (_ for _ in ()).throw(AssertionError("cloud client")))
    monkeypatch.setattr(firestore, "transactional", lambda function: function)
    database = memory_store.install()
    assert firestore.Client() is database
