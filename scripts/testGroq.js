const fs = require('fs');
const { transcribeAudioFile } = require('../src/services/ai.service.js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function test() {
    try {
        console.log('Testing Groq transcription...');
        // Create a fake audio buffer for testing, or just write some bytes
        // But OpenAI's API might complain if it's not a real audio file.
        // Let's create a minimal valid webm or just a tiny dummy buffer to see the error.
        const dummyBuffer = Buffer.from('dummy data', 'utf8');
        const result = await transcribeAudioFile(dummyBuffer, 'chunk.webm');
        console.log('Success:', result);
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response && e.response.data) {
            console.error('Response Data:', e.response.data);
        }
    }
}
test();
