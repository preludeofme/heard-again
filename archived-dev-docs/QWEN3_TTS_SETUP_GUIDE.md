# Qwen3-TTS Local Installation Guide for Ubuntu + RTX 4090

## Overview

This guide will walk you through installing and running **Qwen3-TTS** locally on Ubuntu with an NVIDIA RTX 4090 (24GB VRAM). Qwen3-TTS is an open-source text-to-speech model from Alibaba Cloud supporting voice cloning and custom voices.

---

## Prerequisites

- Ubuntu (latest stable LTS recommended)
- NVIDIA RTX 4090 with 24GB VRAM
- Internet connection for downloading models

---

## Step 1: System Update & Base Dependencies

### 1.1 Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

**Expected result:** System packages updated without errors.

### 1.2 Install Required System Dependencies

```bash
sudo apt install -y python3-pip python3-venv python3-dev git wget curl ffmpeg libsndfile1
```

**Expected result:** All packages installed successfully.

**Verify ffmpeg is installed:**
```bash
ffmpeg -version | head -1
```
**Expected output:** `ffmpeg version X.X.X`

---

## Step 2: Install NVIDIA GPU Drivers & CUDA

### 2.1 Check if NVIDIA Driver is Installed

```bash
nvidia-smi
```

**Expected result:** A table showing GPU info, driver version, and CUDA version.

If you see output like this, skip to Step 2.3:
```
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI XXX.XX.XX              Driver Version: XXX.XX.XX    CUDA Version: 12.X      |
|-----------------------------------------+------------------------+----------------------+
| GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC |
| Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. |
|                                         |                        |               MIG M. |
|=========================================+========================+======================+
|   0  NVIDIA GeForce RTX 4090          |   00000000:01:00.0  Off|                  N/A |
```

### 2.2 Install NVIDIA Driver (if not installed)

```bash
# Add NVIDIA package repositories
distribution=$(. /etc/os-release;echo $ID$VERSION_ID | sed 's/\.//')
wget https://developer.download.nvidia.com/compute/cuda/repos/$distribution/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt update

# Install NVIDIA driver
sudo apt install -y nvidia-driver-550

# Reboot to load driver
sudo reboot
```

After reboot, verify with `nvidia-smi` again.

### 2.3 Install CUDA Toolkit

```bash
# Install CUDA 12.1 (recommended for PyTorch compatibility)
wget https://developer.download.nvidia.com/compute/cuda/12.1.0/local_installers/cuda-repo-ubuntu2204-12-1-local_12.1.0-530.30.02-1_amd64.deb
sudo dpkg -i cuda-repo-ubuntu2204-12-1-local_12.1.0-530.30.02-1_amd64.deb
sudo cp /var/cuda-repo-ubuntu2204-12-1-local/cuda-*-keyring.gpg /usr/share/keyrings/
sudo apt update
sudo apt install -y cuda-12-1
```

**Set environment variables:**
```bash
echo 'export PATH=/usr/local/cuda-12.1/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda-12.1/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

**Verify CUDA installation:**
```bash
nvcc --version
```
**Expected output:** `Cuda compilation tools, release 12.1`

---

## Step 3: Set Up Python Environment

### 3.1 Create a Virtual Environment

```bash
# Create project directory
mkdir -p ~/qwen3-tts && cd ~/qwen3-tts

# Create Python 3.12 virtual environment
python3 -m venv venv

# Activate environment
source venv/bin/activate
```

**Expected result:** Your prompt shows `(venv)` prefix.

### 3.2 Upgrade pip

```bash
pip install --upgrade pip setuptools wheel
```

**Expected result:** pip upgraded to latest version.

---

## Step 4: Install PyTorch with CUDA Support

### 4.1 Install PyTorch (CUDA 12.1 compatible)

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

**Expected result:** PyTorch installed successfully (may take a few minutes).

### 4.2 Verify PyTorch GPU Access

Create a test file:
```bash
cat > test_gpu.py << 'EOF'
import torch
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
print(f"GPU count: {torch.cuda.device_count()}")
if torch.cuda.is_available():
    print(f"GPU name: {torch.cuda.get_device_name(0)}")
    print(f"GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
EOF

python test_gpu.py
```

**Expected output:**
```
PyTorch version: 2.X.X+cu121
CUDA available: True
CUDA version: 12.1
GPU count: 1
GPU name: NVIDIA GeForce RTX 4090
GPU memory: 24.00 GB
```

**Troubleshooting:**
- If `CUDA available: False`, ensure NVIDIA drivers are properly installed
- Reinstall PyTorch with correct CUDA version if needed

---

## Step 5: Install Qwen3-TTS

### 5.1 Clone the Repository

```bash
cd ~/qwen3-tts
git clone https://github.com/QwenLM/Qwen3-TTS.git
```

**Expected result:** Repository cloned to `~/qwen3-tts/Qwen3-TTS`

### 5.2 Install Qwen3-TTS Package

```bash
cd Qwen3-TTS
pip install -e .
```

**Expected result:** Package installed successfully.

### 5.3 Install Additional Dependencies

```bash
pip install soundfile librosa gradio openai-whisper
```

**Note:** `openai-whisper` is for automatic speech-to-text transcription in the web UI.

---

## Step 6: Install FlashAttention 2 (Recommended)

FlashAttention reduces GPU memory usage and improves speed.

```bash
# For machines with less than 96GB RAM, limit parallel jobs
MAX_JOBS=4 pip install flash-attn --no-build-isolation
```

This step can take 10-20 minutes as it compiles from source.

**Expected result:** FlashAttention installed successfully.

**Troubleshooting:**
- If compilation fails, you can skip this step (the model will use standard attention, using more VRAM)
- Ensure you have `python3-dev` installed

---

## Step 7: Start the Web UI (Recommended)

The easiest way to use Qwen3-TTS is through the Gradio web interface with automatic transcription.

### 7.1 Start the Server

```bash
cd ~/qwen3-tts
source venv/bin/activate

# Start the web UI (with English interface and auto-transcribe)
qwen-tts-demo Qwen/Qwen3-TTS-12Hz-1.7B-Base --ip 0.0.0.0 --port 8000 --no-flash-attn
```

**Features:**
- **Auto-Transcribe**: Click the "🎤 Auto-Transcribe" button to automatically detect speech from your reference audio
- **Save/Load Voice**: Create reusable voice profiles (.pt files) for consistent cloning
- **Fully English UI**: All labels and messages are in English

**Access:** Open http://localhost:8000 in your browser

### 7.2 Using the Web UI

1. **Clone & Generate Tab:**
   - Upload your reference audio (10-30 seconds recommended)
   - Click "🎤 Auto-Transcribe" to automatically get the transcript
   - Or type the reference text manually
   - Enter target text you want to synthesize
   - Click "Generate"

2. **Save / Load Voice Tab:**
   - Upload reference audio and auto-transcribe
   - Click "Save Voice File" to download a `.pt` voice profile
   - Later, upload the `.pt` file in "Upload Prompt File" to reuse that voice instantly

---

## Step 8: Command-Line Script (Alternative)

### 7.1 Create the Script

```bash
cd ~/qwen3-tts
cat > generate.py << 'EOF'
#!/usr/bin/env python3
"""
Qwen3-TTS Voice Cloning Script

Usage:
    python generate.py --text "Hello world" --voice reference.wav
    python generate.py --text "Hello world" --voice ref1.wav ref2.wav
"""

import argparse
import os
import sys
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

def main():
    parser = argparse.ArgumentParser(description="Generate speech using Qwen3-TTS voice cloning")
    parser.add_argument("--text", type=str, required=True, help="Text to synthesize")
    parser.add_argument("--voice", type=str, nargs='+', required=True, 
                        help="Path(s) to reference audio file(s) (.wav, .mp3)")
    parser.add_argument("--ref-text", type=str, default=None,
                        help="Transcript of reference audio (optional but recommended)")
    parser.add_argument("--output", type=str, default="output.wav",
                        help="Output audio file path (default: output.wav)")
    parser.add_argument("--language", type=str, default="Auto",
                        help="Language code (default: Auto for auto-detect)")
    parser.add_argument("--model", type=str, default="Qwen/Qwen3-TTS-12Hz-1.7B-Base",
                        help="Model to use (default: Qwen/Qwen3-TTS-12Hz-1.7B-Base)")
    parser.add_argument("--device", type=str, default="cuda:0",
                        help="Device to use (default: cuda:0)")
    parser.add_argument("--dtype", type=str, default="bfloat16",
                        choices=["float16", "bfloat16", "float32"],
                        help="Data type for model (default: bfloat16)")
    
    args = parser.parse_args()
    
    # Verify input files exist
    for voice_file in args.voice:
        if not os.path.exists(voice_file):
            print(f"Error: Voice file not found: {voice_file}")
            sys.exit(1)
    
    # Map dtype string to torch dtype
    dtype_map = {
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "float32": torch.float32
    }
    dtype = dtype_map[args.dtype]
    
    print(f"Loading model: {args.model}")
    print(f"Device: {args.device}, Dtype: {args.dtype}")
    
    # Check FlashAttention availability
    try:
        import flash_attn
        attn_impl = "flash_attention_2"
        print("Using FlashAttention 2")
    except ImportError:
        attn_impl = "sdpa"
        print("FlashAttention not available, using SDPA")
    
    # Load model
    model = Qwen3TTSModel.from_pretrained(
        args.model,
        device_map=args.device,
        dtype=dtype,
        attn_implementation=attn_impl,
    )
    
    print(f"Model loaded successfully!")
    print(f"VRAM used: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
    
    # Handle single or multiple reference audio files
    if len(args.voice) == 1:
        ref_audio = args.voice[0]
        ref_text = args.ref_text if args.ref_text else None
    else:
        # Multiple reference files - use first one for now
        # (Qwen3-TTS Base model uses single reference)
        print(f"Note: Using first reference file from {len(args.voice)} provided")
        ref_audio = args.voice[0]
        ref_text = args.ref_text if args.ref_text else None
    
    print(f"\nGenerating speech...")
    print(f"Text: {args.text}")
    print(f"Reference: {ref_audio}")
    
    # Generate voice clone
    generation_kwargs = {
        "text": args.text,
        "language": args.language,
        "ref_audio": ref_audio,
    }
    
    if ref_text:
        generation_kwargs["ref_text"] = ref_text
    
    wavs, sr = model.generate_voice_clone(**generation_kwargs)
    
    # Save output
    sf.write(args.output, wavs[0], sr)
    
    print(f"\nSuccess! Output saved to: {args.output}")
    print(f"Sample rate: {sr} Hz")
    print(f"Duration: {len(wavs[0]) / sr:.2f} seconds")

if __name__ == "__main__":
    main()
EOF
```

### 7.2 Make Script Executable

```bash
chmod +x generate.py
```

---

## Step 9: Download Sample Reference Audio

Create a sample reference file for testing:

```bash
cd ~/qwen3-tts
wget -O reference.wav "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3-TTS-Repo/clone.wav"
```

**Expected result:** `reference.wav` downloaded (~200KB).

---

## Step 10: Run Basic Inference

### 10.1 Web UI Method (Recommended)

Start the server and use the web interface:

```bash
cd ~/qwen3-tts
source venv/bin/activate
qwen-tts-demo Qwen/Qwen3-TTS-12Hz-1.7B-Base --ip 0.0.0.0 --port 8000 --no-flash-attn
```

Then open http://localhost:8000 and:
1. Upload reference audio
2. Click "🎤 Auto-Transcribe" 
3. Enter target text
4. Click "Generate"

### 10.2 Command-Line Method

```bash
cd ~/qwen3-tts
source venv/bin/activate

python -c "
import torch
from qwen_tts import Qwen3TTSModel

print('Testing model loading...')
model = Qwen3TTSModel.from_pretrained(
    'Qwen/Qwen3-TTS-12Hz-1.7B-Base',
    device_map='cuda:0',
    dtype=torch.bfloat16,
)
print('Model loaded successfully!')
print(f'VRAM used: {torch.cuda.memory_allocated() / 1e9:.2f} GB')
"
```

**Expected output:**
```
Testing model loading...
Model loaded successfully!
VRAM used: X.XX GB
```

### 9.2 Generate First Speech Sample

```bash
# Single voice cloning example
python generate.py \
    --text "Hello! This is a test of Qwen3-TTS voice cloning. The quick brown fox jumps over the lazy dog." \
    --voice reference.wav \
    --ref-text "Okay. Yeah. I resent you. I love you. I respect you. But you know what? You blew it! And thanks to you." \
    --output first_test.wav
```

**Expected result:**
```
Loading model: Qwen/Qwen3-TTS-12Hz-1.7B-Base
Device: cuda:0, Dtype: bfloat16
...
Success! Output saved to: first_test.wav
Sample rate: 12000 Hz
Duration: X.XX seconds
```

### 10.3 Test with Auto Language Detection

```bash
python generate.py \
    --text "Hello world, this is a voice cloning test." \
    --voice reference.wav \
    --output auto_lang_test.wav
```

---

## Step 11: Advanced Features

### 11.1 Custom Voice Model (Pre-defined Speakers)

```bash
cat > generate_custom.py << 'EOF'
#!/usr/bin/env python3
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

# Load custom voice model
model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)

# See available speakers
print("Available speakers:", model.get_supported_speakers())
print("Available languages:", model.get_supported_languages())

# Generate with custom voice
wavs, sr = model.generate_custom_voice(
    text="Hello! This is a custom voice test.",
    language="English",
    speaker="Ryan",  # Try: Vivian, Ryan, Emma, etc.
)

sf.write("custom_voice_output.wav", wavs[0], sr)
print("Saved to custom_voice_output.wav")
EOF

python generate_custom.py
```

### 10.2 Voice Design (Create Custom Voice from Description)

```bash
cat > generate_design.py << 'EOF'
#!/usr/bin/env python3
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

# Load voice design model
model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)

# Design a voice with natural language
wavs, sr = model.generate_voice_design(
    text="Welcome to the future of text to speech technology!",
    language="English",
    instruct="A warm, friendly male voice with a professional tone, mid-30s, clear articulation",
)

sf.write("designed_voice.wav", wavs[0], sr)
print("Saved to designed_voice.wav")
EOF

python generate_design.py
```

### 11.3 Batch Processing with Voice Profiles

Create reusable voice profiles for consistent cloning:

```bash
cat > save_voice_profile.py << 'EOF'
#!/usr/bin/env python3
import torch
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)

# Create voice profile from reference
voice_clone_prompt = model.create_voice_clone_prompt(
    ref_audio="reference.wav",
    ref_text="Your reference transcript here",
)

# Save for later use
torch.save({"items": voice_clone_prompt}, "my_voice_profile.pt")
print("Voice profile saved to my_voice_profile.pt")
EOF

python save_voice_profile.py
```

Use the saved profile:

```bash
cat > use_voice_profile.py << 'EOF'
#!/usr/bin/env python3
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)

# Load voice profile
voice_data = torch.load("my_voice_profile.pt")
voice_clone_prompt = voice_data["items"]

# Generate with saved voice
wavs, sr = model.generate_voice_clone(
    text="This uses the saved voice profile!",
    language="English",
    voice_clone_prompt=voice_clone_prompt,
)

sf.write("output_with_profile.wav", wavs[0], sr)
print("Generated using saved voice profile")
EOF

python use_voice_profile.py
```

---

## Troubleshooting

### Issue: CUDA Out of Memory

**Solution:**
```bash
# Use smaller model
python generate.py --text "..." --voice ref.wav --model Qwen/Qwen3-TTS-12Hz-0.6B-Base

# Or use float16 instead of bfloat16
python generate.py --text "..." --voice ref.wav --dtype float16

# Or reduce batch size in your scripts
```

### Issue: FlashAttention Installation Fails

**Solution:**
```bash
# Skip FlashAttention - model will use SDPA instead (slightly slower, more VRAM)
# Edit generate.py and set attn_impl="sdpa" manually

# Or try reinstalling with specific CUDA
MAX_JOBS=2 pip install flash-attn --no-build-isolation --force-reinstall
```

### Issue: Model Download Fails / Slow

**Solution:**
```bash
# Set HuggingFace cache directory
export HF_HOME="$HOME/.cache/huggingface"

# Or use mirror (if in China)
export HF_ENDPOINT=https://hf-mirror.com
```

### Issue: Audio Quality is Poor

**Solutions:**
1. Ensure reference audio is clear and 10-30 seconds long
2. Provide accurate `ref_text` transcript
3. Use higher quality reference audio (16kHz+ sample rate)
4. Try the 1.7B model instead of 0.6B

### Issue: ImportError: No module named 'qwen_tts'

**Solution:**
```bash
cd ~/qwen3-tts/Qwen3-TTS
pip install -e .
source ../venv/bin/activate
```

### Issue: libsndfile not found

**Solution:**
```bash
sudo apt install libsndfile1-dev
pip install soundfile --force-reinstall
```

---

## Quick Reference Commands

### Activate Environment
```bash
cd ~/qwen3-tts && source venv/bin/activate
```

### Start Web UI Server
```bash
# Base model (voice cloning with auto-transcribe)
qwen-tts-demo Qwen/Qwen3-TTS-12Hz-1.7B-Base --ip 0.0.0.0 --port 8000 --no-flash-attn

# CustomVoice model (pre-defined speakers)
qwen-tts-demo Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice --ip 0.0.0.0 --port 8000 --no-flash-attn

# VoiceDesign model (create voices from text descriptions)
qwen-tts-demo Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign --ip 0.0.0.0 --port 8000 --no-flash-attn
```

### Simple Voice Clone (CLI)
```bash
python generate.py --text "Your text here" --voice reference.wav --output result.wav
```

### Check GPU Usage During Generation
```bash
# In another terminal
watch -n 1 nvidia-smi
```

---

## Summary

You now have a working Qwen3-TTS setup on your RTX 4090 with an enhanced English web UI!

**Key features:**
- **Web UI** at http://localhost:8000 with automatic speech-to-text transcription
- **Voice Profiles** - Save and reuse voices without re-processing
- **Fully English Interface** - All UI text translated from Chinese
- **Command-line scripts** for batch processing

**Key files created:**
- `~/qwen3-tts/generate.py` - CLI voice cloning script
- Modified `demo.py` with auto-transcribe and English UI

**Available models:**
- `Qwen/Qwen3-TTS-12Hz-1.7B-Base` - Voice cloning with auto-transcribe (best quality)
- `Qwen/Qwen3-TTS-12Hz-0.6B-Base` - Voice cloning (lower VRAM)
- `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` - Pre-defined speakers
- `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` - Design voices from text

**Your end goal commands:**
```bash
# Web UI (recommended)
qwen-tts-demo Qwen/Qwen3-TTS-12Hz-1.7B-Base --ip 0.0.0.0 --port 8000 --no-flash-attn

# CLI
python generate.py --text "Hello world" --voice reference.wav
```

Happy voice cloning!
