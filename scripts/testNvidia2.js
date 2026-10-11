const { OpenAI } = require('openai');
const fs = require('fs');

const openai = new OpenAI({
    baseURL: 'https://ai.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_API_KEY
});

async function test() {
    try {
        fs.writeFileSync('test.wav', 'dummy audio content');
        
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream('test.wav'),
            model: 'nvidia/parakeet-ctc-0.6b', 
        });
        console.log("Success:", response);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
