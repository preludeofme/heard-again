FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch with CUDA support
RUN pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create directories for models and generated audio
RUN mkdir -p /app/models /app/generated

EXPOSE 8100

CMD ["python", "-m", "app.main"]
