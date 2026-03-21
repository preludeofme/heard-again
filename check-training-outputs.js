#!/usr/bin/env node

// Check what files are actually created during training
const GPT_SOVITS_URL = 'http://localhost:9874';

async function checkTrainingOutputs() {
  console.log('=== Checking Training Output Files ===\n');
  
  // Check the specific files that should be created
  const expectedFiles = [
    'output/asr_opt/user123.list',
    'output/slicer_opt/user123/',
    'logs/experiments_log/',
    'SoVITS_weights/',
    'GPT_SoVITS/logs/experiments_log',
    'tmp/',
  ];
  
  for (const filePath of expectedFiles) {
    console.log(`\n--- Checking: ${filePath} ---`);
    try {
      const url = `${GPT_SOVITS_URL}/file=${filePath}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const content = await response.text();
        console.log(`✅ Accessible`);
        console.log(`Content preview: ${content.substring(0, 300)}...`);
        
        // Look for .wav files in directory listings
        const wavFiles = content.match(/\S+\.wav/g);
        if (wavFiles && wavFiles.length > 0) {
          console.log(`Found .wav files: ${wavFiles.slice(0, 3).join(', ')}`);
        }
        
        // Look for .list files
        const listFiles = content.match(/\S+\.list/g);
        if (listFiles && listFiles.length > 0) {
          console.log(`Found .list files: ${listFiles.join(', ')}`);
        }
      } else {
        console.log(`❌ Status: ${response.status}`);
        if (response.status === 403) {
          console.log(`   (Access forbidden - Gradio security)`);
        } else if (response.status === 404) {
          console.log(`   (File not found - may not be created yet)`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  // Try to find any .wav files that might exist
  console.log('\n=== Searching for Any .wav Files ===');
  const wavSearchPaths = [
    'output/slicer_opt/user123/',
    'output/asr_opt/',
    'tmp/gradio/',
  ];
  
  for (const searchPath of wavSearchPaths) {
    console.log(`\n--- Searching ${searchPath} for .wav files ---`);
    try {
      const url = `${GPT_SOVITS_URL}/file=${searchPath}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const content = await response.text();
        const wavFiles = content.match(/\S+\.wav/g);
        if (wavFiles && wavFiles.length > 0) {
          console.log(`✅ Found ${wavFiles.length} .wav files:`);
          wavFiles.forEach((file, index) => {
            console.log(`   ${index + 1}. ${file}`);
          });
        } else {
          console.log(`❌ No .wav files found`);
        }
      } else {
        console.log(`❌ Cannot access ${searchPath}`);
      }
    } catch (error) {
      console.log(`❌ Error searching ${searchPath}: ${error.message}`);
    }
  }
  
  // Check if we can access the temp upload directory
  console.log('\n=== Checking Temp Upload Directory ===');
  try {
    const tempResponse = await fetch(`${GPT_SOVITS_URL}/file=tmp/`);
    if (tempResponse.ok) {
      const tempContent = await tempResponse.text();
      console.log(`✅ Temp directory accessible`);
      console.log(`Content: ${tempContent.substring(0, 300)}...`);
      
      // Look for gradio temp folders
      const gradioFolders = tempContent.match(/gradio_\w+/g);
      if (gradioFolders && gradioFolders.length > 0) {
        console.log(`Found Gradio folders: ${gradioFolders.slice(0, 3).join(', ')}`);
        
        // Try to check the most recent gradio folder
        const recentFolder = gradioFolders[gradioFolders.length - 1];
        console.log(`\n--- Checking recent folder: tmp/${recentFolder} ---`);
        try {
          const folderResponse = await fetch(`${GPT_SOVITS_URL}/file=tmp/${recentFolder}/`);
          if (folderResponse.ok) {
            const folderContent = await folderResponse.text();
            console.log(`✅ Folder accessible`);
            console.log(`Files: ${folderContent.substring(0, 300)}...`);
          }
        } catch (folderError) {
          console.log(`❌ Cannot access folder: ${folderError.message}`);
        }
      }
    }
  } catch (tempError) {
    console.log(`❌ Cannot access temp directory: ${tempError.message}`);
  }
}

checkTrainingOutputs().catch(console.error);
