# RunPod Endpoint Verification for Trigger.dev Integration

## Current Status
Based on your project structure and analysis, here is how to verify if your RunPod endpoint is correctly configured in your production system:

## 1. Environment Variables Required
Your system requires these environment variables in your Vercel deployment:

```
# For RunPod TTS integration
RUNPOD_API_KEY="your_runpod_api_key_here"
RUNPOD_TTS_ENDPOINT_ID="your_runpod_endpoint_id_here" 
TTS_PROVIDER="runpod_serverless"

# Trigger.dev settings (if different from defaults) 
TRIGGER_API_URL="http://localhost:3030"
TRIGGER_SECRET_KEY="your_trigger_dev_secret_key_here"
```

## 2. Verification Steps

### Step 1: Verify Vercel Configuration
1. In your Vercel dashboard, verify these variables are set:
   - RUNPOD_API_KEY
   - RUNPOD_TTS_ENDPOINT_ID  
   - TTS_PROVIDER
   - TRIGGER_SECRET_KEY

### Step 2: Test RunPod Endpoint
1. You can create a test to verify RunPod connectivity by running:
```bash
# Test RunPod endpoint from your system
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"action": "ping"}}'
```

## 3. Integration Point (Where Configuration Matters)
Your configuration point is in the TTS provider:

**File**: `/home/trubuck-design/Projects/Personal/heard-again/UI/src/lib/tts/runpod-tts-provider.ts`

The code uses environment variables to determine:
- `RUNPOD_API_KEY` - for API authentication
- `RUNPOD_TTS_ENDPOINT_ID` - for the specific RunPod endpoint

## 4. Production Testing
The workflow is:
Your Vercel UI (Trigger.dev client) → Trigger.dev → Your RunPod endpoint

To verify:
1. Submit a test narration task
2. Monitor Trigger.dev logs
3. Check RunPod execution status

## Issue Resolution
Since you mentioned updating your RunPod endpoint, make sure:
1. The RUNPOD_TTS_ENDPOINT_ID in your Vercel environment matches the new endpoint ID
2. The RUNPOD_API_KEY has access to the new endpoint
3. All existing triggers in the trigger directory are configured to use your new endpoint

The key point is that since you've modified the RunPod setup to use your specific GPU setup (ADA_48_PRO GPUs with fallbacks), ensure these changes are reflected in your production environment variable configuration in Vercel.