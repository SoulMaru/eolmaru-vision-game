"""Load the existing F studio read-only, with bounded generation for game cues.

Run with its already-installed voice-env Python. No model/package downloads.
The model's default 2048-token limit permits runaway short-utterance generation;
this adapter caps new audio tokens using the supplied text length instead.
"""
import importlib.util
import math
import os
from http.server import ThreadingHTTPServer

path = os.environ.get('MARU_STUDIO_SCRIPT',
    'F:/0.SoulmaruAI/1.aiimage/webtoon-translator/local-api/backend/python/voice/tts_server.py')
spec = importlib.util.spec_from_file_location('maru_studio_source', path)
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)
original_load = studio.load_model


def bounded_model(kind):
    model = original_load(kind)
    if not getattr(model, '_maru_bounded', False):
        for name in ('generate_voice_design', 'generate_custom_voice'):
            original = getattr(model, name)

            def generate(*args, _original=original, **kwargs):
                text = kwargs.get('text', '')
                # 12 audio tokens/s: at most 6-16s for these concise game cues.
                limit = max(72, min(192, math.ceil(len(text) * 2.4 + 24)))
                kwargs['max_new_tokens'] = min(kwargs.get('max_new_tokens', limit), limit)
                return _original(*args, **kwargs)

            setattr(model, name, generate)
        model._maru_bounded = True
    return model


studio.load_model = bounded_model
print(f'[maru-voice] bounded F-studio adapter on 127.0.0.1:{studio.PORT}', flush=True)
ThreadingHTTPServer(('127.0.0.1', studio.PORT), studio.Handler).serve_forever()
