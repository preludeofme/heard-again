#!/usr/bin/env node

// Check what files are actually accessible in GPT-SoVITS
const GPT_SOVITS_URL = 'http://localhost:9874';

async function checkAccessibleFiles() {
  console.log('=== Checking Accessible Files ===\n');
  
  // Try to access the root directory or common files
  const testPaths = [
    '',
    '/',
    'tmp/',
    'logs/',
    'output/',
    'workspace/',
    'GPT_SoVITS/',
    'file=logs/',
    'file=output/',
    'file=tmp/',
  ];
  
  for (const path of testPaths) {
    console.log(`\n--- Testing: ${path} ---`);
    try {
      const url = path.includes('file=') 
        ? `${GPT_SOVITS_URL}/${path}`
        : `${GPT_SOVITS_URL}/file=${path}`;
        
      const response = await fetch(url);
      
      if (response.ok) {
        const content = await response.text();
        console.log(`✅ Accessible - Content length: ${content.length}`);
        console.log(`First 200 chars: ${content.substring(0, 200)}`);
      } else {
        console.log(`❌ Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  // Check if we can access the upload directory
  console.log('\n--- Checking Upload Directory ---');
  try {
    const uploadResponse = await fetch(`${GPT_SOVITS_URL}/upload`);
    console.log(`Upload endpoint status: ${uploadResponse.status}`);
  } catch (error) {
    console.log(`Upload endpoint error: ${error.message}`);
  }
  
  // Check config endpoint
  console.log('\n--- Checking Config ---');
  try {
    const configResponse = await fetch(`${GPT_SOVITS_URL}/config`);
    if (configResponse.ok) {
      const config = await configResponse.json();
      console.log(`✅ Config accessible - Functions available: ${Object.keys(config).length}`);
      console.log(`Some function names: ${Object.keys(config).slice(0, 5)}`);
    } else {
      console.log(`❌ Config status: ${configResponse.status}`);
    }
  } catch (error) {
    console.log(`Config error: ${error.message}`);
  }
}

checkAccessibleFiles().catch(console.error);
