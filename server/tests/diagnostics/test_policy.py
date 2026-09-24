import json
from pathlib import Path
import pytest
from server.app.diagnostics.provider_errors import scrub
CASES = json.loads((Path(__file__).resolve().parents[3] / 'redaction-policy/cases.json').read_text())
@pytest.mark.parametrize('sample', CASES, ids=lambda sample: sample['name'])
def test_shared_privacy_and_retention_contract(sample):
    result = scrub(sample['text'], sample['private'])
    for value in sample['kept']:
        assert value in result
    for value in sample['removed']:
        assert value not in result
    if sample.get('tag'):
        assert sample['tag'] in result
    assert scrub(result, sample['private']) == result

def test_authored_exception_explanations_are_explicitly_classified():
    """Reject new literal explanations hidden inside generic ValueError/RuntimeError."""
    import ast
    root = Path(__file__).resolve().parents[2] / 'app'
    missing = []
    for path in root.rglob('*.py'):
        for node in ast.walk(ast.parse(path.read_text())):
            if not isinstance(node, ast.Raise) or not isinstance(node.exc, ast.Call):
                continue
            call = node.exc
            if isinstance(call.func, ast.Name) and call.func.id in {'ValueError', 'RuntimeError'} and call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str):
                missing.append(f'{path.relative_to(root)}:{node.lineno}')
            if isinstance(call.func, ast.Name) and call.func.id in {'DiagnosticValueError', 'DiagnosticRuntimeError'}:
                assert call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str), 'Diagnostic explanations must be authored literals; put values in classified fields'
    assert missing == []


def test_authored_reason_and_parser_position_survive_runtime_sink():
    from server.app.diagnostics.exceptions import DiagnosticValueError, describe
    from server.app.diagnostics import runtime
    error = DiagnosticValueError('Provider stream ended without a completion marker.')
    event = runtime.sanitize({'event': 'provider_failed', 'diagnostics': describe(error)})
    assert event['diagnostics']['causes'][0]['message'] == str(error)
    try:
        json.loads('{\nprivate-parser-canary')
    except json.JSONDecodeError as failure:
        details = describe(failure)
    assert details['causes'][0]['details']['line'] == 2
    assert 'private-parser-canary' not in json.dumps(details)
