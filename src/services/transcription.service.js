const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const fetch = require('node-fetch'); // Using node-fetch for downloading the recording

const openai = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY, // Note: OpenAI library can be used with OpenAI compatible endpoints
});

// Since the user is using OpenAI for Whisper, we need the OPENAI_API_KEY.
// We'll assume process.env.OPENAI_API_KEY is available or they will add it.
// If not, we might need to fallback or log an error.

/**
 * Downloads a file from a URL to a local path
 */
const downloadFile = async (url, outputPath) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(outputPath);
        response.body.pipe(fileStream);
        response.body.on('error', (err) => {
            reject(err);
        });
        fileStream.on('finish', function() {
            resolve(outputPath);
        });
    });
};

/**
 * Transcribes audio from a URL using OpenAI Whisper
 * @param {string} recordingUrl 
 * @returns {Promise<string>}
 */
const transcribeAudio = async (recordingUrl) => {
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY is not set. Skipping transcription.');
        return 'Transcription disabled due to missing OPENAI_API_KEY.';
    }

    const tempDir = path.join(__dirname, '..', '..', 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `recording_${Date.now()}.mp4`); // Dyte recordings are typically mp4 or webm

    try {
        console.log(`Downloading recording from ${recordingUrl}...`);
        await downloadFile(recordingUrl, tempFilePath);

        console.log('Transcribing with Whisper...');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
        });

        console.log('Transcription complete.');
        return transcription.text;
    } catch (error) {
        console.error('Transcription error:', error);
        throw error;
    } finally {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath); // Cleanup
        }
    }
};

module.exports = {
    transcribeAudio
};
