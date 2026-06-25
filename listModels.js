const https = require('https');
const fs = require('fs');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        fs.writeFileSync('models.json', data, 'utf8');
        console.log("Done");
    });
}).on('error', (err) => {
    console.log("Error: " + err.message);
});
