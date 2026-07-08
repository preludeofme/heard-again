# RunPod Endpoint Configuration - Manual Steps

## Current Setup

Your credentials are now configured in `UI/.env`:

```
TTS_PROVIDER=runpod_serverless
RUNPOD_API_KEY=your_runpod_api_key_here
RUNPOD_ENDPOINT_ID=your_runpod_endpoint_id_here
```

**Endpoint Name**: heard-again-qwen3-tts-v2  
**Endpoint ID**: `your_runpod_endpoint_id_here`

## Action Required: Update Idle Timeout in RunPod UI

The API query failed (likely auth permissions), so you need to manually check/update the endpoint settings.

### Steps

1. **Go to**: https://runpod.io/console/serverless
2. **Find**: `heard-again-qwen3-tts-v2` (ID: `8zrnsfsqb8r6u4`)
3. **Click**: The endpoint name to open details
4. **Look for**: "Settings" or "Configuration" tab
5. **Find**: `idleTimeout` or "Idle Timeout" setting

### What to Check

| Setting | Current (likely) | Change To | Why |
|---------|------------------|-----------|-----|
| **idleTimeout** | Unknown (possibly 0 or 10) | **600** | Keeps GPU warm 10 min after request |
| **Endpoint Type** | Web/Load Balancer | **Async (Queue-based)** | ⚠️ CRITICAL: Must be Async/Queue! Web/LB endpoints do not support `/run` or WebSockets. |

### If You See "Idle timeout is not supported for queue endpoints"

This means you're using **Queue-based scaling**. You have two options:

#### Option A: Keep Queue-based (no idleTimeout)
- GPU scales to zero immediately when idle
- Cold start every time (10-15s)
- Warmup still helps if user generates voice immediately
- **Cost**: Lowest (pay per execution only)

#### Option B: Recreate as Async (Queue-based) Worker (recommended for UX)
1. **Create new Serverless endpoint**:
   - Type: **Async (Queue-based)** (DO NOT select Web Endpoint/Load Balancer)
   - Same image: `buc456/heard-again-qwen3-tts:2026-05-29-v10` (or your current image)
   - GPU: RTX 4090
   - Set `idleTimeout: 600`
   - Enable Flash Boot (faster cold starts)
   
2. **Update `.env`**:
   ```bash
   RUNPOD_ENDPOINT_ID=new_worker_endpoint_id
   ```

3. **Test warmup**:
   ```bash
   cd /home/trubuck-design/Projects/Personal/heard-again
   npm run dev
   ```
   Navigate to Voice Lab — should warm GPU automatically.

4. **Delete old Queue endpoint** once verified.

### Cost Impact

| Scenario | Queue (current) | Worker (300s idle) |
|----------|-----------------|---------------------|
| 50 free users/month | ~$0.06 | ~$5-8 |
| 10 premium users (10 min each) | ~$1.15 | ~$6-9 |
| **Total** | **~$1.20** | **~$11-17** |

Both well under $50/month budget. Worker-based provides **much better UX** (fast after first request).

## Testing the Warmup System

After configuring the endpoint:

1. **Start dev server**:
   ```bash
   cd /home/trubuck-design/Projects/Personal/heard-again
   npm run dev
   ```

2. **Navigate to Voice Lab** in your browser (localhost:4777/voice-lab)

3. **Check browser console** for warmup log:
   - Should see: `[Warmup] RunPod GPU warmed` or similar
   - First synthesis should take ~10-15s (cold start)
   - Second synthesis (within 5 min) should take ~1-3s (warm)

4. **Verify API response**:
   ```bash
   curl -X POST http://localhost:4777/api/voice/warmup \
     -H "Content-Type: application/json" \
     -b "next-auth.session-token=YOUR_SESSION_TOKEN"
   ```
   
   Expected:
   ```json
   {
     "success": true,
     "warmed": true,
     "provider": "runpod_serverless",
     "costEstimate": "$0.0002"
   }
   ```

## Troubleshooting

### Warmup returns `warmed: false`
- Check RunPod endpoint is deployed and healthy
- Verify `RUNPOD_API_KEY` is correct (no extra spaces)
- Check RunPod dashboard for endpoint errors

### Synthesis fails with 401/403
- API key may not have endpoint access
- Verify endpoint ID matches exactly: `8zrnsfsqb8r6u4`

### Cold start still 15s+ after warmup
- If Queue-based: normal (GPU scales down between requests)
- If Worker-based: check `idleTimeout` is set to 300+

## Next Steps

1. **Update RunPod endpoint** settings in UI (see above)
2. **Restart dev server** to pick up new `.env` values
3. **Test warmup flow** with Voice Lab
4. **Monitor costs** in RunPod dashboard (should be minimal)

---

**Questions or issues?** Check `TTS/RUNPOD_CONFIG.md` for full documentation.
