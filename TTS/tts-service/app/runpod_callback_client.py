import logging
import os
import requests

logger = logging.getLogger(__name__)


def post_callback(callback_url: str, payload: dict) -> str | None:
    secret = os.getenv("TTS_CALLBACK_SECRET", "")
    headers = {"x-heard-again-tts-secret": secret} if secret else {}
    try:
        response = requests.post(callback_url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        return None
    except Exception as exc:
        logger.warning("Callback failed: %s", exc)
        return str(exc)
