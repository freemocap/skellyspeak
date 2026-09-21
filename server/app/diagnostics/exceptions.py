"""Bounded exception identity and locations; reviewed callers may retain safe prose."""
from pathlib import Path
import json
from starlette.exceptions import HTTPException
from server.app.diagnostics.policy import POLICY
from server.app.diagnostics.provider_errors import scrub, sanitize


class DiagnosticValueError(ValueError):
    """A code-authored explanation; values belong in classified diagnostic fields."""

class DiagnosticRuntimeError(RuntimeError):
    """A code-authored runtime failure, never a formatted request or credential."""


def describe(error: BaseException, *, private=(), include_message=False) -> dict:
    causes = []
    seen = set()
    while error is not None and id(error) not in seen and len(causes) < 8:
        seen.add(id(error))
        frames = []
        trace = error.__traceback__
        while trace is not None and len(frames) < 16:
            code = trace.tb_frame.f_code
            frames.append({"source_file": Path(code.co_filename).name,
                           "function": code.co_name, "line": trace.tb_lineno})
            trace = trace.tb_next
        # Preserve typed facts even when an arbitrary exception can echo content.
        detail = {}
        if isinstance(error, json.JSONDecodeError):
            detail = {"reason": error.msg, "line": error.lineno, "column": error.colno, "offset": error.pos}
        elif isinstance(error, UnicodeError):
            detail = {"reason": error.reason, "start": error.start, "end": error.end}
        elif isinstance(error, OSError):
            detail = {"errno": error.errno, "reason": error.strerror}
        message = scrub(str(error), private) if include_message or isinstance(error, (DiagnosticValueError, DiagnosticRuntimeError)) else POLICY['contentTag']
        if isinstance(error, HTTPException):
            detail = {"status": error.status_code, "detail": sanitize(error.detail, private, field="detail")}
            if isinstance(error.detail, str):
                message = scrub(error.detail, private)
        causes.append({"exception_type": type(error).__name__, "message": message, "frames": frames,
                       "errno": error.errno if isinstance(error, OSError) else None,
                       "details": sanitize(detail, private),
                       "diagnostics": sanitize(getattr(error, "diagnostics", None), private),
                       "frames_truncated": trace is not None})
        error = error.__cause__ or (None if error.__suppress_context__ else error.__context__)
    return {"stage": "server_exception", "causes": causes, "causes_truncated": error is not None}
