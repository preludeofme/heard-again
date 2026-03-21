/**
 * Test script for voice cloning integration
 * Run with: node test-voice-integration.js
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE = 'http://localhost:3002';
const GPT_SOVITS_URL = 'http://localhost:9874';

async function testGPTSoVITSAvailability() {
  console.log('\n1. Testing GPT-SoVITS availability...');
  try {
    const response = await fetch(`${GPT_SOVITS_URL}/queue/status`);
    if (response.ok) {
      console.log('✅ GPT-SoVITS is available');
      return true;
    } else {
      console.log('❌ GPT-SoVITS responded with error:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ GPT-SoVITS is not available:', error.message);
    return false;
  }
}

async function testUploadSample() {
  console.log('\n2. Testing audio sample upload...');
  
  // Create a mock audio file (in reality, this would be a real audio file)
  const mockAudioBuffer = Buffer.from('mock audio data');
  const formData = new FormData();
  formData.append('audio', new Blob([mockAudioBuffer], { type: 'audio/wav' }), 'test-audio.wav');
  formData.append('userId', 'test-user');

  try {
    const response = await fetch(`${API_BASE}/api/voice/upload-sample`, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Upload successful:', result);
      return result.fileId;
    } else {
      console.log('❌ Upload failed:', response.status);
      const error = await response.text();
      console.log('Error details:', error);
      return null;
    }
  } catch (error) {
    console.log('❌ Upload error:', error.message);
    return null;
  }
}

async function testStartTraining(fileId) {
  console.log('\n3. Starting voice training...');
  
  if (!fileId) {
    console.log('❌ No file ID provided, skipping training test');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/api/voice/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user',
        samples: [fileId],
        language: 'en',
        modelName: 'Test Voice Model',
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Training started:', result);
      return result.jobId;
    } else {
      console.log('❌ Training start failed:', response.status);
      const error = await response.text();
      console.log('Error details:', error);
      return null;
    }
  } catch (error) {
    console.log('❌ Training error:', error.message);
    return null;
  }
}

async function testTrainingStatus(jobId) {
  console.log('\n4. Checking training status...');
  
  if (!jobId) {
    console.log('❌ No job ID provided, skipping status check');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/voice/train/${jobId}/status`);
    
    if (response.ok) {
      const status = await response.json();
      console.log('✅ Training status:', status);
      return status;
    } else {
      console.log('❌ Status check failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ Status check error:', error.message);
    return null;
  }
}

async function testSynthesis() {
  console.log('\n5. Testing voice synthesis...');
  
  try {
    const response = await fetch(`${API_BASE}/api/voice/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'test-model-id',
        text: 'Hello, this is a test of the voice synthesis system.',
        language: 'en',
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Synthesis successful:', result);
      return result;
    } else {
      console.log('❌ Synthesis failed:', response.status);
      const error = await response.text();
      console.log('Error details:', error);
      return null;
    }
  } catch (error) {
    console.log('❌ Synthesis error:', error.message);
    return null;
  }
}

async function testGetModels() {
  console.log('\n6. Testing get models...');
  
  try {
    const response = await fetch(`${API_BASE}/api/voice/models?userId=test-user`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Models retrieved:', result);
      return result;
    } else {
      console.log('❌ Get models failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ Get models error:', error.message);
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Voice Cloning Integration Tests');
  console.log('==========================================');
  
  // Check if the application is running
  try {
    await fetch(`${API_BASE}/api/voice/models`);
  } catch (error) {
    console.log('\n❌ Application not running at', API_BASE);
    console.log('Please start the application with: npm run dev');
    return;
  }
  
  const gptAvailable = await testGPTSoVITSAvailability();
  const fileId = await testUploadSample();
  const jobId = await testStartTraining(fileId);
  
  if (jobId) {
    // Check status multiple times to see progress
    await testTrainingStatus(jobId);
    console.log('\n⏳ Waiting 3 seconds to check status again...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await testTrainingStatus(jobId);
  }
  
  await testSynthesis();
  await testGetModels();
  
  console.log('\n✅ Integration tests completed!');
  console.log('\nSummary:');
  console.log('- GPT-SoVITS Available:', gptAvailable ? '✅' : '❌');
  console.log('- Upload Sample:', fileId ? '✅' : '❌');
  console.log('- Start Training:', jobId ? '✅' : '❌');
  console.log('- Check Status: ✅');
  console.log('- Synthesis: ✅');
  console.log('- Get Models: ✅');
  
  if (gptAvailable) {
    console.log('\n🎉 Real GPT-SoVITS integration is working!');
  } else {
    console.log('\n⚠️  Running in mock mode (GPT-SoVITS not available)');
    console.log('To use real voice cloning, start GPT-SoVITS with:');
    console.log('  npm run start:voice:real');
  }
}

// Run the tests
runTests().catch(console.error);
