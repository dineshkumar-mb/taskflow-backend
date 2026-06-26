const { OpenAI } = require('openai');
const fs = require('fs');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || 'your-api-key-here'
});

async function test() {
    try {
        // Create a dummy file
        fs.writeFileSync('test.wav', 'dummy audio content');
        
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream('test.wav'),
            model: 'openai/whisper-1', // Or whatever OpenRouter uses
        });
        console.log("Success:", response);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
