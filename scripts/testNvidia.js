const { OpenAI } = require('openai');
const fs = require('fs');

const openai = new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_API_KEY || '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'
});

async function test() {
    try {
        fs.writeFileSync('test.wav', 'dummy audio content');
        
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream('test.wav'),
            model: 'nvidia/parakeet-ctc-0.6b', // Or whatever
        });
        console.log("Success:", response);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
