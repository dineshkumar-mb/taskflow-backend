const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
};

const data = JSON.stringify({
    name: 'Verification User',
    email: `verify_${Date.now()}@example.com`,
    password: 'Password123!',
});

console.log('Starting SaaS Flow Verification (Lite)...');

const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', responseData);

        if (res.statusCode === 201) {
            console.log('Registration Success!');
        } else {
            console.error('Registration Failed.');
        }
    });
});

req.on('error', (error) => {
    console.error('Request Error:', error.message);
});

req.write(data);
req.end();
