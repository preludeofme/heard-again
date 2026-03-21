# GPT-SoVITS Integration Guide

## Current Status

The GPT-SoVITS Docker container is running successfully, but full integration requires mapping to the Gradio API endpoints.

## What's Working

✅ GPT-SoVITS server running on `http://localhost:9874`
✅ Web UI accessible at `http://localhost:9873`
✅ GPU acceleration enabled
✅ Your app detects when GPT-SoVITS is available

## What Needs Integration

### The Challenge
GPT-SoVITS uses a Gradio web interface with function indices that change between versions. To properly integrate, we need to:

1. **Discover the correct function indices** for training and synthesis
2. **Map input parameters** to match GPT-SoVITS expectations
3. **Handle file uploads** through Gradio's system
4. **Parse responses** and extract model paths

### Current Approach
For now, the system uses mock training even when GPT-SoVITS is detected. This allows you to:
- Test the UI workflow
- Verify GPT-SoVITS is running
- Prepare for full integration

## Manual GPT-SoVITS Usage

While we work on the API integration, you can use GPT-SoVITS directly:

### 1. Access the Web UI
Open `http://localhost:9873` in your browser

### 2. Training Workflow
1. **Upload Audio**: Go to the "1A.语音切分工具" (Audio Splitting Tool)
2. **Process Audio**: Use the tools to prepare your audio files
3. **Train Model**: Navigate to "3B.训练" (Training) section
4. **Configure Settings**: Set model name and parameters
5. **Start Training**: Click train button (uses GPU)

### 3. Synthesis Workflow
1. **Select Model**: Choose your trained model
2. **Input Text**: Type text to synthesize
3. **Generate**: Click synthesis button
4. **Download**: Get the generated audio

## API Integration Steps

To complete the API integration:

### Step 1: Discover Function Indices
```bash
curl http://localhost:9874/config | jq '.dependencies | length'
```

### Step 2: Map Training Function
```javascript
// Need to identify which fn_index handles training
// Look for functions that accept audio files and model names
```

### Step 3: Map Synthesis Function
```javascript
// Find the synthesis fn_index
// Usually accepts text, model reference, and language
```

### Step 4: Handle File Uploads
GPT-SoVITS expects files uploaded through Gradio's system:
```javascript
// First upload files to /upload endpoint
// Then use returned file references in training calls
```

## Alternative: Direct Python Integration

For production use, consider:
1. **Creating a custom API wrapper** in Python
2. **Using GPT-SoVITS as a library** instead of web UI
3. **Building a dedicated microservice** for voice operations

## Next Steps

1. **Short Term**: Continue using mock for UI testing
2. **Medium Term**: Map Gradio API endpoints
3. **Long Term**: Consider direct Python integration

## Testing

To test GPT-SoVITS manually:
1. Record a 1-5 minute audio clip
2. Upload to `http://localhost:9873`
3. Follow the training workflow
4. Test synthesis with your trained model

The trained models will be saved in `./models` directory and can be referenced in synthesis requests.
