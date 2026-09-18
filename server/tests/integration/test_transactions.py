"""Exercise the real SDK retry decorator without network or private records."""
from unittest.mock import Mock

import pytest
from google.api_core.exceptions import Aborted, DeadlineExceeded
from google.cloud import firestore

from server.app import transactions


def transaction_client(monkeypatch, commits):
    client = Mock()
    created = []
    retry_ids = []
    outcomes = iter(commits)

    def create(*, max_attempts):
        transaction = firestore.Transaction(client, max_attempts=max_attempts)
        created.append(transaction)

        def begin(retry_id=None):
            retry_ids.append(retry_id)
            transaction._id = f"transaction-{len(retry_ids)}".encode()

        def commit():
            error = next(outcomes)
            if error is not None:
                raise error

        transaction._begin = begin
        transaction._commit = commit
        transaction._rollback = Mock()
        return transaction

    client.transaction.side_effect = create
    monkeypatch.setattr(transactions.time, "sleep", lambda _: None)
    return client, created, retry_ids


def test_aborted_commit_rolls_back_before_fresh_retry(monkeypatch):
    client, created, retry_ids = transaction_client(monkeypatch, [Aborted("contention"), None])

    @firestore.transactional
    def apply(transaction):
        if len(created) == 2:
            created[0]._rollback.assert_called_once()
        return "committed"

    assert transactions.run(client, apply) == "committed"
    assert len(created) == 2
    assert retry_ids == [None, None]


def test_exhausted_commits_fail_without_restarting_retry_budget(monkeypatch):
    client, created, retry_ids = transaction_client(monkeypatch, [Aborted("contention")] * 6)

    @firestore.transactional
    def apply(transaction):
        return "uncommitted"

    with pytest.raises(ValueError) as error:
        transactions.run(client, apply)
    assert isinstance(error.value.__cause__, Aborted)
    assert len(created) == 6 and len(retry_ids) == 6
    for transaction in created:
        transaction._rollback.assert_called_once()


def test_aborted_read_rolls_back_before_a_fresh_attempt(monkeypatch):
    client, created, _ = transaction_client(monkeypatch, [None])
    calls = 0

    @firestore.transactional
    def apply(transaction):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise Aborted("read contention")
        created[0]._rollback.assert_called_once()
        return "committed"

    assert transactions.run(client, apply) == "committed"
    assert len(created) == 2


@pytest.mark.parametrize("error", [ValueError("invalid data"), DeadlineExceeded("unknown outcome")])
def test_non_abort_failures_are_never_replayed(monkeypatch, error):
    client, created, _ = transaction_client(monkeypatch, [])

    @firestore.transactional
    def apply(transaction):
        raise error

    with pytest.raises(type(error)):
        transactions.run(client, apply)
    assert len(created) == 1
