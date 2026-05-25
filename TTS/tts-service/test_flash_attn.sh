#!/bin/bash
docker run --rm runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04 pip install flash-attn --no-build-isolation
