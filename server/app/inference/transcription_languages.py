"""Credential availability only; language support and selection belong to native."""
from server.app.inference.speech_catalog import CATALOG


def availability(cfg):
    available = []
    for model, definition in CATALOG['models'].items():
        configured = bool(cfg.groq_key) if definition['provider'] == 'groq' else bool(cfg.elevenlabs_key)
        if definition['task'] == 'speech':
            configured = configured and bool(cfg.elevenlabs_voice_id) and model in cfg.tts_models
        if configured:
            available.append(model)
    return {'version': 1, 'available_models': available,
            'accepts_custom_transcription_models': bool(cfg.groq_key)}
