#!/usr/bin/env node

// Debug script to check GPT-SoVITS file structure
const GPT_SOVITS_URL = 'http://localhost:9874';

async function checkFileSystem() {
  console.log('=== GPT-SoVITS File System Debug ===\n');
  
  const pathsToCheck = [
    'output/slicer_opt/user123/',
    'output/asr_opt/user123.list',
    'output/asr_opt/',
    'logs/experiments_log/',
    'SoVITS_weights/',
  ];
  
  for (const path of pathsToCheck) {
    console.log(`\n--- Checking: ${path} ---`);
    try {
      const url = `${GPT_SOVITS_URL}/file=${path}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const content = await response.text();
        console.log(`✅ Accessible`);
        console.log(`Content (first 500 chars):`);
        console.log(content.substring(0, 500));
        if (content.length > 500) {
          console.log('...(truncated)');
        }
      } else {
        console.log(`❌ Status: ${response.status}`);
        const errorText = await response.text();
        console.log(`Error: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n=== Test Synthesis with Debug ===');
  
  // Test what happens during synthesis
  console.log('\nTesting synthesis call...');
  try {
    const synthesisResponse = await fetch('http://localhost:3002/api/voice/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'test-model-id',
        text: 'This is a test.',
        language: 'en'
      })
    });
    
    const result = await synthesisResponse.json();
    console.log('Synthesis response:', result);
  } catch (error) {
    console.log('Synthesis error:', error.message);
  }
}

checkFileSystem().catch(console.error);
