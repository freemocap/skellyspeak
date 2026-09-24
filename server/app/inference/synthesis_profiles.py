"""Identity of effective synthesis settings, independent of callers and secrets."""
import hashlib
import json


def profile_id(cfg):
    # Bump the preparation/output revisions when their executable contracts change.
    fields = {"provider": "elevenlabs", "model": cfg.tts_model,
              "voice": cfg.elevenlabs_voice_id, "preparation": 1,
              "output": "mono-pcm16-24000-wav-v1"}
    return hashlib.sha256(json.dumps(fields, sort_keys=True, separators=(",", ":"))
                          .encode("utf-8")).hexdigest()
