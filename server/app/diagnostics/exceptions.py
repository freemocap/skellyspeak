"""Exception identity and code locations, never messages, source lines or locals."""
from pathlib import Path


def describe(error: BaseException) -> dict:
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
        causes.append({"exception_type": type(error).__name__, "frames": frames,
                       "frames_truncated": trace is not None})
        error = error.__cause__ or (None if error.__suppress_context__ else error.__context__)
    return {"stage": "server_exception", "causes": causes, "causes_truncated": error is not None}
