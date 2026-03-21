#!/usr/bin/env node

// Try to use GPT-SoVITS API to discover available files and models
const GPT_SOVITS_URL = 'http://localhost:9874';

async function checkGPTSoVITSAPI() {
  console.log('=== Checking GPT-SoVITS API Capabilities ===\n');
  
  // Check the config to see what functions are available
  console.log('--- Checking Available Functions ---');
  try {
    const configResponse = await fetch(`${GPT_SOVITS_URL}/config`);
    if (configResponse.ok) {
      const config = await configResponse.json();
      console.log(`✅ Config accessible`);
      console.log(`Available functions: ${Object.keys(config).length}`);
      
      // Look for functions that might help us find files
      const relevantFunctions = Object.keys(config).filter(key => 
        key.toLowerCase().includes('file') || 
        key.toLowerCase().includes('model') ||
        key.toLowerCase().includes('refresh')
      );
      
      if (relevantFunctions.length > 0) {
        console.log(`Relevant functions: ${relevantFunctions.join(', ')}`);
      }
      
      // Try to call refresh_models function (usually fn_index 22)
      console.log('\n--- Trying to Refresh Models ---');
      try {
        const refreshResponse = await fetch(`${GPT_SOVITS_URL}/run/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [],
            fn_index: 22
          })
        });
        
        if (refreshResponse.ok) {
          const refreshResult = await refreshResponse.json();
          console.log(`✅ Refresh models successful:`, refreshResult.data?.[0]);
        } else {
          console.log(`❌ Refresh models failed: ${refreshResponse.status}`);
        }
      } catch (refreshError) {
        console.log(`❌ Refresh models error: ${refreshError.message}`);
      }
    }
  } catch (configError) {
    console.log(`❌ Config error: ${configError.message}`);
  }
  
  // Check if there are any other API endpoints we can use
  console.log('\n--- Checking Other Endpoints ---');
  const endpoints = [
    '/api',
    '/data',
    '/file',
    '/queue/active',
    '/queue/status',
    '/runtime_state',
    '/components',
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${GPT_SOVITS_URL}${endpoint}`);
      console.log(`${endpoint}: ${response.status}`);
      
      if (response.ok) {
        const content = await response.text();
        if (content.length > 0 && content.length < 500) {
          console.log(`  Content: ${content.substring(0, 200)}...`);
        }
      }
    } catch (error) {
      console.log(`${endpoint}: Error - ${error.message}`);
    }
  }
  
  // Try to get the current queue status to see if there are any active jobs
  console.log('\n--- Checking Queue Status ---');
  try {
    const queueResponse = await fetch(`${GPT_SOVITS_URL}/queue/status`);
    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      console.log(`✅ Queue status:`, queueData);
    } else {
      console.log(`❌ Queue status: ${queueResponse.status}`);
    }
  } catch (queueError) {
    console.log(`❌ Queue error: ${queueError.message}`);
  }
  
  // Check if we can access any model information
  console.log('\n--- Checking Model Information ---');
  try {
    const modelResponse = await fetch(`${GPT_SOVITS_URL}/file=logs/experiments_log`);
    if (modelResponse.ok) {
      const modelData = await modelResponse.text();
      console.log(`✅ Model log accessible`);
      console.log(`Model log content: ${modelData.substring(0, 500)}...`);
    } else {
      console.log(`❌ Model log: ${modelResponse.status}`);
    }
  } catch (modelError) {
    console.log(`❌ Model log error: ${modelError.message}`);
  }
}

checkGPTSoVITSAPI().catch(console.error);
