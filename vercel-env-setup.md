# Vercel Environment Setup for Trigger.dev Integration

## Environment Variables for Production

To properly integrate with Trigger.dev in production, you'll need to configure these environment variables in your Vercel project settings:

### Core Trigger.dev Configuration
```
TRIGGER_SECRET_KEY="your_trigger_dev_secret_key_here"
TRIGGER_API_URL="http://localhost:3030"  # For local development
```

### RunPod Integration
```
RUNPOD_API_KEY="your_runpod_api_key_here"
RUNPOD_TTS_ENDPOINT_ID="your_runpod_tts_endpoint_id_here"
TTS_PROVIDER="runpod_serverless"
```

### Vercel-Specific URL
```
UI_URL="https://your-vercel-domain.com"
```

## Steps to Set Up:

1. In your Vercel project settings, go to Environment Variables
2. Add the variables above with their respective values
3. For TRIGGER_SECRET_KEY, you'll need to:
   - Visit http://localhost:3030 in your browser (if running locally)
   - Create an account in Trigger.dev
   - Copy your access token
   - Use that in your Vercel environment

## Production Deployment Verification

To verify the setup works:

1. Make a test API call to your Vercel-hosted UI
2. Trigger a test narration task
3. Check that the task execution reaches RunPod