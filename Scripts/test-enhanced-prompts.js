#!/usr/bin/env node

// Test the enhanced prompt text generation
console.log('=== Enhanced Prompt Text Generation Test ===\n');

const testModels = [
  'grandpa_buck_6aa96fa1',
  'voice_model_mar_20__2026_ed7d8de0', 
  'grandpabuck_3ad7e207',
  'test_model_abc123def'
];

testModels.forEach(modelName => {
  console.log(`--- Model: ${modelName} ---`);
  
  // Simulate the enhanced prompt text generation
  const modelSpecificPrompts = [
    `Good morning everyone! My name is ${modelName.replace(/_/g, ' ')} and I'm delighted to speak with you today. I hope you're having a wonderful day.`,
    `Hello there! I'm ${modelName.slice(0, 10).replace(/_/g, ' ')} and it's a pleasure to meet you. How are you feeling right now?`,
    `Hi friends! This is ${modelName.replace(/_/g, ' ').slice(0, 15)} speaking. I'm excited to have this conversation with you!`,
    `Greetings! I am the voice model known as ${modelName.slice(-8)}. It's wonderful to connect with you today.`,
    `Hey there! I'm ${modelName.replace(/_/g, ' ')} and I'm really happy to be here. What would you like to talk about?`,
    `Well hello! I go by ${modelName.slice(0, 12).replace(/_/g, ' ')} and I'm looking forward to our chat. Nice to meet you!`,
    `Hi! You can call me ${modelName.replace(/_/g, ' ')} and I'm glad we get to speak. How has your day been?`,
    `Hello everybody! I'm ${modelName.slice(-12).replace(/_/g, ' ')} and it's great to be here with you now.`,
  ];
  
  const promptIndex = modelName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % modelSpecificPrompts.length;
  const selectedPrompt = modelSpecificPrompts[promptIndex];
  
  console.log(`   Index: ${promptIndex}`);
  console.log(`   Prompt: "${selectedPrompt}"`);
  console.log(`   Character count: ${selectedPrompt.length}`);
  console.log('');
});

console.log('=== Expected Impact ===');
console.log('✅ More dramatic prompt text differences');
console.log('✅ Longer prompts with more emotional content');
console.log('✅ Different sentence structures and vocabulary');
console.log('✅ More noticeable voice characteristics');
console.log('\nThese enhanced prompts should create much more noticeable differences in voice synthesis!');
