"""Provider language conversion from the generated shared capability catalog.

Selection belongs to native configuration resolution. This boundary only validates
and translates the captured model/language identity; it never changes models.
"""
import re
from server.app.inference.speech_catalog import CATALOG

WHISPER_MODELS = frozenset(model for model, definition in CATALOG['models'].items()
                           if definition['provider'] == 'groq' and definition['task'] == 'transcription')


def primary_code(tag):
    if not isinstance(tag, str) or len(tag) > 80 or not re.fullmatch(r'[a-z]{2,3}(?:-[A-Za-z0-9]{1,8})*', tag):
        return None
    return tag.split('-')[0]


def language_code(model, tag, task):
    definition = CATALOG['models'].get(model)
    if definition is None or definition['task'] != task:
        return None
    code = primary_code(tag)
    listed = CATALOG['language_sets'][definition['languages']].get(code)
    return listed if listed is not None else code if definition['allow_unlisted_languages'] else None


def whisper_code(tag):
    return language_code('whisper-large-v3', tag, 'transcription')


def scribe_code(tag):
    return language_code('scribe_v2', tag, 'transcription')


def availability(cfg):
    available = []
    for model, definition in CATALOG['models'].items():
        configured = bool(cfg.groq_key) if definition['provider'] == 'groq' else bool(cfg.elevenlabs_key)
        if definition['task'] == 'speech':
            configured = configured and bool(cfg.elevenlabs_voice_id) and model == cfg.tts_model
        if configured:
            available.append(model)
    return {'version': 1, 'available_models': available,
            'accepts_custom_transcription_models': bool(cfg.groq_key)}
