-- Add triggerRunId to VoiceGenerationJob for tracking RunPod trigger job IDs
ALTER TABLE "VoiceGenerationJob" ADD COLUMN IF NOT EXISTS "triggerRunId" TEXT;
