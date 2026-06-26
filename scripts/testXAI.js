const { OpenAI } = require('openai');
require('dotenv').config({ path: '../.env' });

async function test() {
    try {
        const openai = new OpenAI({
            baseURL: 'https://api.x.ai/v1',
            apiKey: process.env.GROQ_API_KEY
        });

        // Try dummy request
        const fs = require('fs');
        fs.writeFileSync('dummy.webm', 'test');
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream('dummy.webm'),
            model: 'grok-beta',
        });
        console.log(response);
    } catch (e) {
        console.error(e.message);
    }
}
test();
