// Test script to find correct GPT-SoVITS function indices

async function testFunctionIndex(fnIndex, data = []) {
  try {
    const response = await fetch('http://localhost:9874/run/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: data,
        fn_index: fnIndex
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`Function ${fnIndex}: SUCCESS`);
      console.log('  Input count:', data.length);
      console.log('  Output:', JSON.stringify(result, null, 2).substring(0, 200) + '...');
      return true;
    } else {
      console.log(`Function ${fnIndex}: FAILED (${response.status})`);
      return false;
    }
  } catch (error) {
    console.log(`Function ${fnIndex}: ERROR - ${error.message}`);
    return false;
  }
}

// Test common function indices
async function findTrainingFunction() {
  console.log('Testing GPT-SoVITS function indices...\n');
  
  // Test synthesis (usually fn_index 0)
  await testFunctionIndex(0, ['Hello world', 'test_model', 'en']);
  
  // Test preprocessing (usually fn_index 1)
  await testFunctionIndex(1, [['/path/to/audio.wav'], true, true]);
  
  // Test ASR (usually fn_index 2)
  await testFunctionIndex(2, [['/path/to/audio.wav'], 'en']);
  
  // Test training (try several indices)
  for (let i = 3; i <= 10; i++) {
    await testFunctionIndex(i, [
      ['/path/to/audio1.wav', '/path/to/audio2.wav'],
      'test_model',
      'en',
      { noiseReduction: true, voiceSeparation: true }
    ]);
  }
}

findTrainingFunction();
