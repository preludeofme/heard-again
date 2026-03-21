// Test the actual training workflow

async function testTraining() {
  console.log('Testing voice training workflow...\n');
  
  // 1. Upload a sample audio file
  console.log('1. Uploading sample audio...');
  const formData = new FormData();
  // Create a mock audio file
  const audioBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
  formData.append('audio', audioBlob, 'test-audio.wav');
  formData.append('userId', 'test-user');
  
  const uploadResponse = await fetch('http://localhost:3002/api/voice/upload-sample', {
    method: 'POST',
    body: formData
  });
  
  if (!uploadResponse.ok) {
    console.error('Upload failed:', uploadResponse.status);
    return;
  }
  
  const uploadResult = await uploadResponse.json();
  console.log('Upload successful:', uploadResult.data?.fileId);
  
  // 2. Start training
  console.log('\n2. Starting training...');
  const trainResponse = await fetch('http://localhost:3002/api/voice/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user',
      samples: [uploadResult.data?.fileId],
      language: 'en',
      modelName: 'Test Model'
    })
  });
  
  if (!trainResponse.ok) {
    console.error('Training failed:', trainResponse.status);
    const error = await trainResponse.text();
    console.error('Error:', error);
    return;
  }
  
  const trainResult = await trainResponse.json();
  console.log('Training started:', trainResult);
  
  // 3. Check GPT-SoVITS queue
  console.log('\n3. Checking GPT-SoVITS queue...');
  const queueResponse = await fetch('http://localhost:9874/queue/status');
  const queueData = await queueResponse.json();
  console.log('Queue status:', queueData);
  
  // 4. Check training status
  if (trainResult.jobId) {
    console.log('\n4. Checking training status...');
    const statusResponse = await fetch(`http://localhost:3002/api/voice/train/${trainResult.jobId}/status`);
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('Training status:', status);
    }
  }
}

testTraining().catch(console.error);
