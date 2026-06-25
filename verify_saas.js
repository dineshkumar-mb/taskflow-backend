const axios = require('axios');

const API_URL = 'http://localhost:5001/api';
const agent = axios.create({ baseURL: API_URL, withCredentials: true });

async function verify() {
    console.log('Starting SaaS Flow Verification...');

    try {
        // 1. Register User
        console.log('\n--- 1. Testing Registration ---');
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            name: 'Verification User',
            email: `verify_${Date.now()}@example.com`,
            password: 'Password123!'
        });
        console.log('Registration Success:', regRes.data.email);
        const userId = regRes.data._id;
        const orgId = regRes.data.organizationId;
        console.log('Organization Created:', orgId);

        // Extract cookie
        const cookie = regRes.headers['set-cookie'];

        // 2. Check Organization Stats
        console.log('\n--- 2. Checking Dashboard Stats ---');
        const statsRes = await axios.get(`${API_URL}/analytics/org`, {
            headers: { Cookie: cookie.join('; ') }
        });
        console.log('Stats:', statsRes.data);

        // 3. Create Projects (Testing Limits)
        console.log('\n--- 3. Testing Project Limits (Free Plan = 2) ---');
        for (let i = 1; i <= 3; i++) {
            try {
                const projRes = await axios.post(`${API_URL}/projects`,
                    { name: `Project ${i}`, key: `P${i}`, description: 'Test' },
                    { headers: { Cookie: cookie.join('; ') } }
                );
                console.log(`Project ${i} created:`, projRes.data.name);
            } catch (error) {
                console.log(`Project ${i} failed (Expected for Project 3):`, error.response?.data?.message);
            }
        }

        console.log('\nVerification Complete!');
    } catch (error) {
        console.error('Verification Error:', error.response?.data || error.message);
    }
}

verify();
