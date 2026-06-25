const http = require('http');

const data = JSON.stringify({ message: 'test without project' });

const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/ai/copilot',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        // Using a hardcoded ID from the error trace or a mocked valid ObjectID
        'x-organization-id': '65e7a9b0d9c8b7a6f5e4d3c2'
    }
};

const req = http.request(options, res => {
    let responseData = '';

    res.on('data', chunk => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Response: ${responseData}`);
    });
});

req.on('error', error => {
    console.error(`Error: ${error.message}`);
});

req.write(data);
req.end();
