const fs = require('fs');
const path = 'src/services/ai.service.js';
let content = fs.readFileSync(path, 'utf8');

const toAppend = `
// ─────────────────────────────────────────────
// 7. AI RISK DETECTION
// ─────────────────────────────────────────────
exports.analyzeRisk = async (projectData) => {
    try {
        const model = getModel('gemini-1.5-pro'); // Use getModel from factory, fallback will be handled
        if (!model) throw new Error('AI not configured');

        const prompt = \`You are an expert Agile Project Manager and Risk Analyst. 
Analyze the following project data and identify potential risks, bottlenecks, and areas of concern.

Project Data:
\${JSON.stringify(projectData, null, 2)}

Provide your response ONLY as valid JSON matching this structure:
{
    "overallHealth": "Healthy|At Risk|Critical",
    "riskScore": "Number between 1-100",
    "keyRisks": [
        {
            "title": "Short title of the risk",
            "description": "Detailed explanation of why this is a risk",
            "severity": "High|Medium|Low",
            "suggestedAction": "Actionable recommendation to mitigate the risk"
        }
    ],
    "summary": "A 2-3 sentence executive summary of the project's current state."
}\`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON response (strip markdown if present)
        const jsonMatch = responseText.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('Error analyzing risk:', error);
        throw new Error(\`Failed to analyze risk: \${error.message}\`);
    }
};

exports.transcribeAudioFile = async (buffer, filename) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const { OpenAI } = require('openai');
        
        // Write the buffer to a temporary file
        const tempFilePath = path.join(os.tmpdir(), \`\${Date.now()}_\${filename}\`);
        fs.writeFileSync(tempFilePath, buffer);

        // Configure OpenAI SDK to use Groq API Key
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
        });

        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: modelName,
        });
        fs.unlinkSync(tempFilePath); // cleanup
        return response.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw new Error(\`Failed to transcribe audio: \${error.message}\`);
    }
};
`;

fs.writeFileSync(path, content + toAppend, 'utf8');
console.log('Appended to ai.service.js successfully.');
