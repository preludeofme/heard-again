#!/usr/bin/env node

// Check the TTS inference endpoint (port 9880)
const TTS_URL = 'http://localhost:9880';

async function checkTTSEndpoint() {
  console.log('=== Checking TTS Inference Endpoint ===\n');
  
  try {
    // Check if the endpoint is accessible
    const response = await fetch(TTS_URL);
    console.log(`TTS endpoint status: ${response.status}`);
    
    if (response.ok) {
      const content = await response.text();
      console.log(`TTS endpoint content: ${content.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`TTS endpoint error: ${error.message}`);
  }
  
  // Try a synthesis request to see what happens
  console.log('\n--- Testing Direct Synthesis ---');
  try {
    const synthesisResponse = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refer_wav_path: 'output/slicer_opt/user123/a33a78c1-3773-4308-8ba5-b6f1fa5f7d6f.m4a_0000032000_0000096000.wav',
        prompt_text: 'Hello, this is a test.',
        prompt_language: 'en',
        text: 'This should sound like the trained voice.',
        text_language: 'en'
      })
    });
    
    console.log(`Direct synthesis status: ${synthesisResponse.status}`);
    
    if (synthesisResponse.ok) {
      const audioBuffer = await synthesisResponse.arrayBuffer();
      console.log(`Audio received: ${audioBuffer.byteLength} bytes`);
    } else {
      const error = await synthesisResponse.text();
      console.log(`Synthesis error: ${error.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`Direct synthesis error: ${error.message}`);
  }
}

checkTTSEndpoint().catch(console.error);
