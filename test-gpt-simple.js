// Simple test to check GPT-SoVITS functions

async function testFunction(fnIndex, description) {
  console.log(`\nTesting ${description} (fn_index: ${fnIndex})...`);
  
  try {
    const response = await fetch('http://localhost:9874/run/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [],
        fn_index: fnIndex
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✓ Success:`, result.data ? result.data[0] : 'No data');
      return true;
    } else {
      const error = await response.text();
      console.log(`✗ Failed (${response.status}):`, error.substring(0, 100));
      return false;
    }
  } catch (error) {
    console.log(`✗ Error:`, error.message);
    return false;
  }
}

// Test various functions
async function runTests() {
  console.log('Testing GPT-SoVITS functions...\n');
  
  // Test basic functions
  await testFunction(0, 'Synthesis');
  await testFunction(1, 'Preprocessing');
  await testFunction(2, 'ASR');
  await testFunction(3, 'Training');
  
  // Test the buttons we found
  await testFunction(18, 'SoVITS Training');
  await testFunction(31, 'Denoise');
  await testFunction(118, 'SoVITS Training Button');
  await testFunction(133, 'GPT Training');
  
  console.log('\nDone!');
}

runTests();
