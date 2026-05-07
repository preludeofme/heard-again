FROM python:3.10-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    wget \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch with CUDA support (large layer — cached separately)
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cu118

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.10-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 tts && useradd -u 1001 -g tts -s /bin/sh -m tts

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=tts:tts app/ ./app/

# Create data directories (volumes will mount over these)
RUN mkdir -p /app/models /app/generated /app/reference_audio /app/voice_profiles \
    && chown -R tts:tts /app

USER tts

EXPOSE 4779

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4779/api/tts/health || exit 1

CMD ["python", "-m", "app.main"]
