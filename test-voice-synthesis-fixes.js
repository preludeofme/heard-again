#!/usr/bin/env node

// Test script to verify voice synthesis fixes
// This script helps test that different models produce different voices

const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:9874';

async function testVoiceSynthesis() {
  console.log('=== Voice Synthesis Test ===\n');
  
  // Test 1: Check if GPT-SoVITS is available
  console.log('1. Checking GPT-SoVITS availability...');
  try {
    const response = await fetch(`${GPT_SOVITS_URL}/queue/status`, {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      console.log('✅ GPT-SoVITS is available');
    } else {
      console.log('❌ GPT-SoVITS returned error:', response.status);
      return;
    }
  } catch (error) {
    console.log('❌ GPT-SoVITS is not available:', error.message);
    console.log('Please start GPT-SoVITS with: npm run start:voice');
    return;
  }
  
  // Test 2: Check available models
  console.log('\n2. Checking available models...');
  try {
    const modelsResponse = await fetch(`${GPT_SOVITS_URL}/file=logs/experiments_log`);
    if (modelsResponse.ok) {
      const logContent = await modelsResponse.text();
      console.log('✅ Models log accessible');
      console.log('Log content (first 200 chars):', logContent.substring(0, 200));
    } else {
      console.log('❌ Could not access models log:', modelsResponse.status);
    }
  } catch (error) {
    console.log('❌ Error checking models:', error.message);
  }
  
  // Test 3: Check file structure for user123
  console.log('\n3. Checking file structure...');
  const pathsToCheck = [
    'output/slicer_opt/user123/',
    'output/asr_opt/',
    'logs/experiments_log/',
    'SoVITS_weights/'
  ];
  
  for (const path of pathsToCheck) {
    try {
      const pathResponse = await fetch(`${GPT_SOVITS_URL}/file=${path}`);
      if (pathResponse.ok) {
        const listing = await pathResponse.text();
        console.log(`✅ ${path} - accessible`);
        const wavFiles = listing.match(/\S+\.wav/g);
        if (wavFiles && wavFiles.length > 0) {
          console.log(`   Found ${wavFiles.length} .wav files:`, wavFiles.slice(0, 3));
        }
      } else {
        console.log(`❌ ${path} - not accessible (${pathResponse.status})`);
      }
    } catch (error) {
      console.log(`❌ ${path} - error:`, error.message);
    }
  }
  
  // Test 4: Test synthesis API endpoint
  console.log('\n4. Testing synthesis API...');
  try {
    const synthesisTest = await fetch('http://localhost:3002/api/voice/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'test-model-id',
        text: 'This is a test of the voice synthesis system.',
        language: 'en'
      })
    });
    
    if (synthesisTest.ok) {
      console.log('✅ Synthesis API responded successfully');
      const result = await synthesisTest.json();
      console.log('Response:', result);
    } else {
      const error = await synthesisTest.json();
      console.log('❌ Synthesis API failed:', error);
    }
  } catch (error) {
    console.log('❌ Synthesis API error:', error.message);
  }
  
  console.log('\n=== Test Complete ===');
  console.log('\nNext steps:');
  console.log('1. Upload different audio files and train separate models');
  console.log('2. Test synthesis with each trained model');
  console.log('3. Check the console logs to see which reference audio files are being used');
  console.log('4. Verify that the output audio sounds different for each model');
}

// Run the test
testVoiceSynthesis().catch(console.error);
