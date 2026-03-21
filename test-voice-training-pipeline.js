// Test script for voice training pipeline
// Run with: node test-voice-training-pipeline.js

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3002';
const GPT_SOVITS_URL = 'http://localhost:9874';

// Test configuration
const testConfig = {
  userId: 'test-user-' + Date.now(),
  modelName: 'Test Voice Model ' + new Date().toISOString(),
  language: 'en',
  // You'll need to provide an actual audio file for testing
  audioFilePath: './test-audio.wav' // Create or place a test audio file here
};

async function testGPTSoVITSConnection() {
  console.log('\n1. Testing GPT-SoVITS connection...');
  
  try {
    const response = await fetch(`${GPT_SOVITS_URL}/queue/status`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      console.log('✓ GPT-SoVITS is running and accessible');
      return true;
    } else {
      console.log('✗ GPT-SoVITS returned error:', response.status);
      return false;
    }
  } catch (error) {
    console.log('✗ GPT-SoVITS is not accessible:', error.message);
    console.log('  Make sure to run: npm run start:voice');
    return false;
  }
}

async function testAudioUpload() {
  console.log('\n2. Testing audio upload...');
  
  if (!fs.existsSync(testConfig.audioFilePath)) {
    console.log('✗ Test audio file not found at:', testConfig.audioFilePath);
    console.log('  Please provide a valid audio file for testing');
    return null;
  }
  
  try {
    const formData = new FormData();
    const audioFile = fs.readFileSync(testConfig.audioFilePath);
    const blob = new Blob([audioFile], { type: 'audio/wav' });
    formData.append('audio', blob, 'test-audio.wav');
    formData.append('userId', testConfig.userId);
    
    const response = await fetch(`${BASE_URL}/api/voice/upload-sample`, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ Audio uploaded successfully');
      console.log('  File ID:', result.data.fileId);
      console.log('  GPT Path:', result.data.gptPath);
      return result.data.fileId;
    } else {
      console.log('✗ Upload failed:', response.status);
      const error = await response.text();
      console.log('  Error:', error);
      return null;
    }
  } catch (error) {
    console.log('✗ Upload error:', error.message);
    return null;
  }
}

async function testAudioSlicing(fileId) {
  console.log('\n3. Testing audio slicing...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/voice/preprocess/slice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testConfig.userId,
        sampleId: fileId,
        options: {
          threshold: '-34',
          minLength: '4000',
          minInterval: '300'
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ Audio slicing completed');
      console.log('  Sliced files:', result.slicedFiles.length);
      console.log('  Using real GPT:', result.usingRealGPT);
      return result.slicedFiles;
    } else {
      console.log('✗ Slicing failed:', response.status);
      return [];
    }
  } catch (error) {
    console.log('✗ Slicing error:', error.message);
    return [];
  }
}

async function testASRTranscription(slicedFiles) {
  console.log('\n4. Testing ASR transcription...');
  
  if (slicedFiles.length === 0) {
    console.log('✗ No sliced files to transcribe');
    return [];
  }
  
  try {
    const response = await fetch(`${BASE_URL}/api/voice/asr/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testConfig.userId,
        audioFiles: slicedFiles,
        language: testConfig.language
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ ASR transcription completed');
      console.log('  Transcripts:', result.transcripts.length);
      console.log('  Using real GPT:', result.usingRealGPT);
      return result.transcripts;
    } else {
      console.log('✗ ASR failed:', response.status);
      return [];
    }
  } catch (error) {
    console.log('✗ ASR error:', error.message);
    return [];
  }
}

async function testListFileGeneration(transcripts) {
  console.log('\n5. Testing .list file generation...');
  
  if (transcripts.length === 0) {
    console.log('✗ No transcripts to generate list file');
    return null;
  }
  
  try {
    const response = await fetch(`${BASE_URL}/api/voice/preprocess/generate-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testConfig.userId,
        transcripts: transcripts,
        language: testConfig.language.toUpperCase(),
        outputFileName: 'test_training.list'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ List file generated successfully');
      console.log('  List file:', result.listFile);
      console.log('  Container path:', result.containerPath);
      console.log('  Entries:', result.entryCount);
      return result.containerPath;
    } else {
      console.log('✗ List generation failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('✗ List generation error:', error.message);
    return null;
  }
}

async function testTrainingStart(fileId) {
  console.log('\n6. Testing training start...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/voice/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testConfig.userId,
        samples: [fileId],
        language: testConfig.language,
        modelName: testConfig.modelName
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ Training started successfully');
      console.log('  Job ID:', result.jobId);
      console.log('  Model ID:', result.modelId);
      console.log('  Model Name:', result.modelName);
      console.log('  Using real GPT:', result.usingRealGPT);
      return result.jobId;
    } else {
      console.log('✗ Training start failed:', response.status);
      const error = await response.text();
      console.log('  Error:', error);
      return null;
    }
  } catch (error) {
    console.log('✗ Training start error:', error.message);
    return null;
  }
}

async function testTrainingStatus(jobId) {
  console.log('\n7. Testing training status check...');
  
  if (!jobId) {
    console.log('✗ No job ID to check');
    return;
  }
  
  try {
    const response = await fetch(`${BASE_URL}/api/voice/train/${jobId}/status`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ Status retrieved successfully');
      console.log('  Status:', result.status);
      console.log('  Progress:', result.progress + '%');
      console.log('  Stage:', result.currentStage);
      console.log('  Using real GPT:', result.usingRealGPT);
      
      if (result.error) {
        console.log('  Error:', result.error);
      }
    } else {
      console.log('✗ Status check failed:', response.status);
    }
  } catch (error) {
    console.log('✗ Status check error:', error.message);
  }
}

async function testModelRetrieval() {
  console.log('\n8. Testing model retrieval...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/voice/models?userId=${testConfig.userId}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ Models retrieved successfully');
      console.log('  Total models:', result.count);
      console.log('  GPT available:', result.gptAvailable);
      
      result.models.forEach(model => {
        console.log(`  - ${model.name} (${model.status})`);
      });
    } else {
      console.log('✗ Model retrieval failed:', response.status);
    }
  } catch (error) {
    console.log('✗ Model retrieval error:', error.message);
  }
}

async function runFullTest() {
  console.log('=== Voice Training Pipeline Test ===');
  console.log('Test Configuration:');
  console.log('  User ID:', testConfig.userId);
  console.log('  Model Name:', testConfig.modelName);
  console.log('  Language:', testConfig.language);
  console.log('  Audio File:', testConfig.audioFilePath);
  
  // Test GPT-SoVITS connection
  const gptAvailable = await testGPTSoVITSConnection();
  
  // Test audio upload
  const fileId = await testAudioUpload();
  if (!fileId) {
    console.log('\n❌ Test failed at audio upload stage');
    return;
  }
  
  // Test audio slicing
  const slicedFiles = await testAudioSlicing(fileId);
  
  // Test ASR transcription
  const transcripts = await testASRTranscription(slicedFiles);
  
  // Test list file generation
  const listFile = await testListFileGeneration(transcripts);
  
  // Test training start
  const jobId = await testTrainingStart(fileId);
  if (!jobId) {
    console.log('\n❌ Test failed at training start stage');
    return;
  }
  
  // Wait a bit then check status
  console.log('\n⏳ Waiting 3 seconds before checking status...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  await testTrainingStatus(jobId);
  
  // Test model retrieval
  await testModelRetrieval();
  
  console.log('\n=== Test Complete ===');
  if (gptAvailable) {
    console.log('✓ All tests completed with real GPT-SoVITS integration');
  } else {
    console.log('⚠ All tests completed with mock implementations');
    console.log('  Start GPT-SoVITS with: npm run start:voice');
  }
}

// Check if we're in Node.js environment
if (typeof window === 'undefined') {
  // Node.js environment - run the test
  runFullTest().catch(console.error);
} else {
  console.log('This test script should be run with Node.js:');
  console.log('node test-voice-training-pipeline.js');
}
