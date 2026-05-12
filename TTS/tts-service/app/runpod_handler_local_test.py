import json
import os

from app.runpod_handler import handler

if __name__ == "__main__":
    os.environ.setdefault("TTS_STUB_MODE", "true")
    event = {"input": {
        "jobId": "local_test_1",
        "text": "Hello from local test",
        "outputKey": "local-tests/local_test_1.mp3"
    }}
    print(json.dumps(handler(event), indent=2))
