require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    console.log('Testing Gemini API...');
    const key = process.env.GEMINI_API_KEY;
    console.log('Key length:', key ? key.length : 'N/A');

    if (!key || key === 'your_gemini_api_key_here') {
        console.error('ERROR: GEMINI_API_KEY not configured correctly in .env');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent("Say hello!");
        console.log('RESPONSE:', result.response.text());
        console.log('SUCCESS: Gemini is working!');
    } catch (error) {
        console.error('GEMINI TEST FAILED:');
        console.error(error);
    }
}

testGemini();
