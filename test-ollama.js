/**
 * test-ollama.js
 * Run: node test-ollama.js
 * Tests: Ollama connectivity + extraction quality
 */
require('dotenv').config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

async function run() {
    console.log(`\n🦙 Testing Ollama at ${OLLAMA_BASE_URL} with model: ${OLLAMA_MODEL}\n`);

    // 1. Health check
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        const data = await res.json();
        const modelNames = (data.models || []).map(m => m.name);
        console.log('✅ Ollama is running!');
        console.log('   Available models:', modelNames.join(', ') || '(none pulled yet)');

        if (!modelNames.some(n => n.includes('llama3.2'))) {
            console.warn('\n⚠️  llama3.2:3b not found. Run: ollama pull llama3.2:3b\n');
        }
    } catch (err) {
        console.error('❌ Ollama not reachable:', err.message);
        console.error('   Start it with: ollama serve');
        process.exit(1);
    }

    // 2. Extraction test
    console.log('\n📤 Testing structured issue extraction...');
    const prompt = `Extract Jira issue details from the user message below.
Return ONLY valid JSON. No explanation. No markdown.

Available projects:
- IDE Project
- Demo Project

Rules:
- projectName: match to one of the available projects if mentioned. Return null if not mentioned.
- title: concise issue title (max 10 words).
- assignee: full name if mentioned, otherwise null.
- priority: one of "low", "medium", "high", "critical", or null.
- issueType: one of "task", "bug", "story", "epic", "subtask", or null.

User message: "create a high priority bug in ide project and assign to nandhini"

Respond with this exact JSON shape:
{"projectName": null, "title": null, "assignee": null, "priority": null, "issueType": null}`;

    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt,
                stream: false,
                format: 'json',
                options: { temperature: 0.1, num_predict: 256 },
            }),
        });
        const data = await res.json();
        const text = (data.response || '').trim();
        console.log('   Raw response:', text);
        const parsed = JSON.parse(text);
        console.log('\n✅ Parsed result:');
        console.table(parsed);

        // Validate
        const ok = parsed.projectName?.toLowerCase().includes('ide') &&
            parsed.priority === 'high' &&
            parsed.issueType === 'bug';
        console.log(ok ? '\n🎉 Extraction quality: PASS' : '\n⚠️  Extraction quality: needs review');
    } catch (err) {
        console.error('❌ Extraction test failed:', err.message);
    }

    // 3. Chat test
    console.log('\n💬 Testing copilot chat...');
    const chatPrompt = `You are TaskFlow Copilot, a Jira assistant.

User: what can you help me with?

You MUST respond with ONLY a valid JSON object:
{"action": "general_chat", "message": "your reply", "missingFields": [], "issueData": null}`;

    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: chatPrompt,
                stream: false,
                format: 'json',
                options: { temperature: 0.1, num_predict: 256 },
            }),
        });
        const data = await res.json();
        const text = (data.response || '').trim();
        const parsed = JSON.parse(text);
        console.log(`✅ Chat response (${parsed.action}): "${parsed.message?.slice(0, 100)}..."`);
    } catch (err) {
        console.error('❌ Chat test failed:', err.message);
    }

    console.log('\n✅ All tests done. Backend will now use Ollama as primary AI.\n');
}

run();
