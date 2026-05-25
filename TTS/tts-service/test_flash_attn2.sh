#!/bin/bash
docker run --rm -v $(pwd)/requirements.txt:/requirements.txt runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04 /bin/bash -c "pip install -r /requirements.txt && pip install --no-build-isolation flash-attn==2.6.3"
