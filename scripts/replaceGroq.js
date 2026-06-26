const fs = require('fs');

const path = 'src/services/ai.service.js';
let content = fs.readFileSync(path, 'utf8');

const targetContent = `        // Configure OpenAI SDK to use NVIDIA API Key
        // Fallback to standard OpenAI if NVIDIA is not provided
        const openai = new OpenAI({
            baseURL: process.env.NVIDIA_API_KEY ? 'https://integrate.api.nvidia.com/v1' : 'https://api.openai.com/v1',
            apiKey: process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY
        });

        // Some API gateways or NVIDIA don't require the model field for audio if it's default, but OpenAI does.
        // We will default to whisper-1 for standard OpenAI, but for NVIDIA we might try without or let it default.
        const modelName = process.env.NVIDIA_API_KEY ? 'nvidia/parakeet-ctc-0.6b' : 'whisper-1';`;

const replacementContent = `        // Configure OpenAI SDK to use Groq API Key
        // Fallback to standard OpenAI or NVIDIA if Groq is not provided
        const apiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY;
        
        let baseURL = 'https://api.openai.com/v1';
        let modelName = 'whisper-1';

        if (process.env.GROQ_API_KEY || process.env.GROK_API_KEY) {
            baseURL = 'https://api.groq.com/openai/v1';
            modelName = 'whisper-large-v3'; // Groq's extremely fast open-source whisper model
        } else if (process.env.NVIDIA_API_KEY) {
            baseURL = 'https://integrate.api.nvidia.com/v1';
            modelName = 'nvidia/parakeet-ctc-0.6b';
        }

        const openai = new OpenAI({
            baseURL: baseURL,
            apiKey: apiKey
        });`;

content = content.replace(targetContent, replacementContent);
fs.writeFileSync(path, content, 'utf8');
console.log('done');
