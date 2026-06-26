const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

// ─────────────────────────────────────────────────────────────────────────────
// OLLAMA  LOCAL LLM CLIENT
// Primary AI engine — free, unlimited, runs on your own hardware.
// Fallback: Gemini 2.5-flash → 2.0-flash → rule-based
// ─────────────────────────────────────────────────────────────────────────────
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

/**
 * Send a prompt to the local Ollama server.
 * Returns { text, parsed } or throws on connection error.
 */
async function callOllama(prompt, { json = true, timeoutMs = 60000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const body = {
            model: OLLAMA_MODEL,
            prompt,
            stream: false,
            ...(json ? { format: 'json' } : {}),
            options: {
                temperature: 0.1,   // Low temp → consistent structured output
                num_predict: 512,
            },
        };

        const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
            throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
        }

        const data = await res.json();
        const text = (data.response || '').trim();
        let parsed = null;

        if (json) {
            try { parsed = JSON.parse(text); } catch (_) {
                const m = text.match(/\{[\s\S]*\}/);
                if (m) { try { parsed = JSON.parse(m[0]); } catch (_) { } }
            }
        }

        return { text, parsed, source: 'ollama' };
    } catch (err) {
        clearTimeout(timer);
        // Detect all flavours of "server not running" across Windows & Unix:
        // Windows Node fetch: "fetch failed", "TypeError: fetch failed"
        // Unix: err.code = 'ECONNREFUSED'
        const msg = (err.message || '').toLowerCase();
        const isDown =
            err.code === 'ECONNREFUSED' ||
            err.code === 'ENOTFOUND' ||
            err.name === 'AbortError' ||
            msg.includes('econnrefused') ||
            msg.includes('fetch failed') ||
            msg.includes('failed to fetch') ||
            msg.includes('network error') ||
            msg.includes('enotfound');
        if (isDown) {
            const e = new Error('Ollama not running');
            e.isOllamaDown = true;
            throw e;
        }
        throw err;
    }
}

/**
 * Quick ping to check if Ollama is up.
 */
async function isOllamaAvailable() {
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            signal: AbortSignal.timeout(2000),
        });
        return res.ok;
    } catch {
        return false;
    }
}


// ─────────────────────────────────────────────
// SHARED SYSTEM PROMPT  (Fix 1 — ACTION ENGINE)
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are "TaskFlow Copilot", an advanced AI assistant embedded inside a Jira-like project management SaaS.

Your mission is to help teams plan, manage, and execute software projects efficiently by automating issue analysis, sprint planning, and project insights.

You operate as a combination of:
• Senior Software Architect
• Agile Scrum Master
• Product Manager
• Technical Project Manager

You assist users by transforming natural language into structured project data.

------------------------------------
CORE RESPONSIBILITIES
------------------------------------

1. ISSUE UNDERSTANDING
When a user provides a feature request, bug report, or task description:
• Extract clear issue information
• Create a concise issue title
• Expand the description if needed
• Detect missing fields
• Infer priority and issue type

2. ISSUE BREAKDOWN
If the request describes a large feature:
• Break it into smaller actionable tasks
• Suggest subtasks
• Suggest implementation steps

3. STORY POINT ESTIMATION
Estimate effort using Fibonacci scale:
1 → trivial
2 → small
3 → moderate
5 → medium
8 → complex
13 → very complex

Consider:
• technical complexity
• integrations
• UI work
• backend logic
• testing requirements

Provide a short reasoning for the estimation.

4. ISSUE SUMMARIZATION
Generate concise summaries of issues that allow developers or managers to quickly understand the work.
Also extract actionable implementation tasks.

5. SPRINT PLANNING
When given a backlog:
• prioritize high-impact work
• select issues that fit a typical sprint capacity
• avoid exceeding total story points
• prefer issues that unblock others

6. PROJECT CONTEXT AWARENESS
If project information is provided:
• use it to answer questions
• give context-aware recommendations
• reference relevant issues when possible

If no project context exists:
inform the user they are operating in the global workspace.

------------------------------------
OUTPUT REQUIREMENTS
------------------------------------

When structured data is requested:
ALWAYS return valid JSON only.
Never include explanations outside JSON.

------------------------------------
COMMUNICATION STYLE
------------------------------------

Be:
• concise
• structured
• practical
• developer-friendly

Use bullet points when explaining workflows.
Avoid unnecessary long explanations.

------------------------------------
IMPORTANT RULES
------------------------------------

• Never fabricate project data
• Never invent user information
• If information is missing, return null
• Do not include markdown when JSON is requested
• Only output JSON when asked for structured responses
• Always keep responses deterministic and structured

------------------------------------
ACTION ENGINE
------------------------------------

When a user message is received, determine the intent.

Possible intents:
1. create_issue
2. create_project
3. estimate_issue
4. sprint_planning
5. general_chat

------------------------------------
ISSUE CREATION RULES
------------------------------------

Required fields:
- title
- description
- priority
- type

If ALL fields exist → immediately return structured JSON with action "create_issue".
If some fields are missing → ask only for missing fields, set action "ask_missing_fields".
Never restart the conversation if information already exists.
Merge any data from conversationState before checking for missing fields.

------------------------------------
PROJECT CREATION RULES
------------------------------------

Required fields:
- name

Optional fields (auto-fill if missing):
- key: Provide a 2-4 uppercase letter key derived from the project name (e.g., "Rule Engine" -> "RE").

If the user wants to create a project, return action "create_project" and populate "projectData" with the project name and key.

------------------------------------
OUTPUT FORMAT (Chat Mode)
------------------------------------

Always return JSON in chat mode. Never return plain text.

{
  "action": "create_issue | create_project | ask_missing_fields | estimate_issue | sprint_planning | general_chat",
  "message": "assistant response in plain text",
  "missingFields": [],
  "issueData": {
    "title": "",
    "description": "",
    "priority": "",
    "type": ""
  },
  "projectData": {
    "name": "",
    "key": ""
  }
}

- "action" drives the backend workflow engine.
- "message" is displayed to the user.
- "missingFields" lists what is still needed (empty array if nothing missing).
- "issueData" contains extracted or merged issue fields (null values for unknown fields).

You are an AI assistant supporting project management workflows inside the TaskFlow application.
`;

// ─────────────────────────────────────────────
// MODEL FACTORY  (primary + fallback)
// ─────────────────────────────────────────────
const getModel = (modelName = 'gemini-2.5-flash') => {
    // 1. Try NVIDIA API first if configured
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey && nvidiaKey !== 'your_nvidia_api_key_here') {
        const openai = new OpenAI({
            apiKey: nvidiaKey,
            baseURL: 'https://integrate.api.nvidia.com/v1',
        });
        
        return {
            generateContent: async (prompt) => {
                // Map Gemini model names to NVIDIA models if necessary
                let nModel = modelName;
                if (modelName.includes('gemini')) {
                    nModel = 'meta/llama-3.1-8b-instruct'; // Default fallback
                }
                
                const response = await openai.chat.completions.create({
                    model: nModel,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.2,
                    top_p: 0.8,
                    max_tokens: 2048,
                });
                return {
                    response: {
                        text: () => response.choices[0].message.content
                    }
                };
            }
        };
    }

    // 2. Fallback to Gemini
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'your_gemini_api_key_here') return null;
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.2,
            topP: 0.8,
        },
    });
};

// ─────────────────────────────────────────────
// SAFE JSON CALL
// Tries primary model → fallback model → rule-based fallback
// ─────────────────────────────────────────────
async function callGeminiWithFallback(prompt) {
    const primaryModel = getModel('gemini-2.5-flash');
    const fallbackModel = getModel('gemini-2.0-flash');

    // Try primary model
    if (primaryModel) {
        try {
            const result = await primaryModel.generateContent(prompt);
            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return { text, parsed: jsonMatch ? JSON.parse(jsonMatch[0]) : null, source: 'primary' };
        } catch (err) {
            const is429 = err.status === 429 || (err.message && err.message.includes('429'));
            if (is429) {
                console.warn('[AI] Primary model rate-limited. Switching to fallback model...');
            } else {
                console.error('[AI] Primary model error:', err.message);
                throw err; // non-rate-limit errors: re-throw
            }
        }
    }

    // Try fallback model (gemini-2.0-flash has separate quota)
    if (fallbackModel) {
        try {
            console.log('[AI] Using fallback model: gemini-2.0-flash');
            const result = await fallbackModel.generateContent(prompt);
            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return { text, parsed: jsonMatch ? JSON.parse(jsonMatch[0]) : null, source: 'fallback' };
        } catch (err) {
            console.error('[AI] Fallback model also failed:', err.message);
        }
    }

    return { text: null, parsed: null, source: 'none' };
}

// ─────────────────────────────────────────────
// 1. ISSUE SUMMARY
// @route POST /api/ai/summary
// ─────────────────────────────────────────────
exports.generateIssueSummary = async (title, description) => {
    const model = getModel();
    if (!model) {
        return {
            summary: "AI service not configured. Please add GEMINI_API_KEY.",
            actionItems: ["Configure API Key"]
        };
    }

    const prompt = `
${SYSTEM_PROMPT}

TASK:
Analyze the following issue and generate a concise summary and actionable tasks.

INPUT
Title: ${title}
Description: ${description}

OUTPUT FORMAT
Return ONLY JSON:

{
  "summary": "2 sentence TLDR summary",
  "actionItems": [
    "implementation task",
    "implementation task"
  ]
}
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text, actionItems: [] };
    } catch (error) {
        console.error('Gemini Error (Summary):', error.message || error);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return { summary: "AI currently rate limited. Please try again in a minute.", actionItems: [] };
        }
        return { summary: "Failed to generate summary due to AI service error.", actionItems: [] };
    }
};

// ─────────────────────────────────────────────
// 2. STORY POINT ESTIMATION
// @route POST /api/ai/estimate
// ─────────────────────────────────────────────
exports.estimateStoryPoints = async (title, description, type, priority) => {
    const model = getModel();
    if (!model) return { points: 1, reason: "AI not configured" };

    const prompt = `
${SYSTEM_PROMPT}

TASK:
Estimate the effort required for this issue using Fibonacci story points.

ISSUE
Title: ${title}
Description: ${description}
Type: ${type}
Priority: ${priority}

CONSIDER
• development complexity
• UI requirements
• backend logic
• integrations
• testing effort

RETURN JSON ONLY

{
  "points": 1 | 2 | 3 | 5 | 8 | 13,
  "reason": "short reasoning explaining complexity"
}
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { points: 1, reason: text };
    } catch (error) {
        console.error('Gemini Error (Estimate):', error.message || error);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return { points: 1, reason: "AI currently rate limited. Please try again in a minute." };
        }
        return { points: 1, reason: "Failed to estimate points due to AI service error." };
    }
};

// ─────────────────────────────────────────────
// 6. STRUCTURED ISSUE EXTRACTION
// Tries: Ollama → Gemini → rule-based
// ─────────────────────────────────────────────
exports.extractStructuredIssueData = async (message, availableProjects = []) => {
    const projectList = availableProjects.length
        ? `Available projects (match exactly if mentioned):\n${availableProjects.map(p => `- ${p.name}`).join('\n')}`
        : '';

    const prompt = `Extract Jira issue details from the user message below.
Return ONLY valid JSON. No explanation. No markdown. No extra text.

${projectList}

Rules:
- projectName: match to one of the available projects if mentioned. Return null if not mentioned.
- title: concise issue title (max 10 words).
- assignee: full name if mentioned, otherwise null.
- priority: one of "low", "medium", "high", "critical", or null.
- issueType: one of "task", "bug", "story", "epic", "subtask", or null.

User message: "${message}"

Respond with this exact JSON shape:
{"projectName": null, "title": null, "assignee": null, "priority": null, "issueType": null}`;

    // 1️⃣ Try Ollama (free, local, unlimited)
    try {
        const { parsed, source } = await callOllama(prompt, { json: true });
        if (parsed && (parsed.title || parsed.projectName)) {
            console.log(`[AI] extractStructuredIssueData via ${source}:`, parsed);
            return parsed;
        }
    } catch (err) {
        if (err.isOllamaDown) {
            console.warn('[AI] Ollama not running — falling back to Gemini for extraction');
        } else {
            console.error('[AI] Ollama extraction error:', err.message);
        }
    }

    // 2️⃣ Gemini fallback (rate-limited, but better than nothing)
    try {
        const { parsed, source } = await callGeminiWithFallback(prompt);
        if (parsed) {
            console.log(`[AI] extractStructuredIssueData via ${source}:`, parsed);
            return parsed;
        }
    } catch (err) {
        console.error('[AI] Gemini extraction also failed:', err.message);
    }

    // 3️⃣ Pure rule-based fallback
    return extractIssueDataWithRules(message, availableProjects);
};

// ─────────────────────────────────────────────
// Rule-based extraction fallback
// Used when ALL AI models are rate-limited or unavailable.
// Handles the most common natural language patterns.
// ─────────────────────────────────────────────
function extractIssueDataWithRules(message, availableProjects = []) {
    const msg = message.toLowerCase();
    const result = { projectName: null, title: null, assignee: null, priority: null, issueType: null };

    // ── Project: scan for each known project name in the message ─────────────
    if (availableProjects.length) {
        for (const p of availableProjects) {
            if (msg.includes(p.name.toLowerCase())) {
                result.projectName = p.name;
                break;
            }
        }
    }

    // ── Priority keywords ─────────────────────────────────────────────────────
    if (msg.includes('critical') || msg.includes('blocker')) result.priority = 'critical';
    else if (msg.includes('high')) result.priority = 'high';
    else if (msg.includes('medium') || msg.includes('moderate')) result.priority = 'medium';
    else if (msg.includes('low')) result.priority = 'low';

    // ── Issue type keywords ───────────────────────────────────────────────────
    if (msg.includes('bug') || msg.includes('crash') || msg.includes('error') || msg.includes('fix')) result.issueType = 'bug';
    else if (msg.includes('epic')) result.issueType = 'epic';
    else if (msg.includes('story') || msg.includes('feature') || msg.includes('as a user')) result.issueType = 'story';
    else if (msg.includes('subtask') || msg.includes('sub-task')) result.issueType = 'subtask';
    else if (msg.includes('task')) result.issueType = 'task';

    // ── Assignee: look for "to [Name]" or "assign to [Name]" ──────────────────
    const assigneeMatch = message.match(/(?:to|assign(?:ed)?\s+to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (assigneeMatch) result.assignee = assigneeMatch[1].trim();

    // ── Title: strip project name, priority, assignee, action words ───────────
    let titleMsg = message
        .replace(/(?:create|make|add|build|implement|develop)\s+(?:a\s+)?(?:new\s+)?/i, '')
        .replace(/(?:task|bug|story|epic|issue)\s+of\s+/i, '')
        .replace(/for\s+(?:the\s+)?\w+\s+project/i, '')
        .replace(/in\s+(?:the\s+)?\w+\s+project/i, '')
        .replace(/(?:to|assign(?:ed)?\s+to)\s+[\w\s]+/i, '')
        .replace(/priority\s+(?:is\s+)?(?:low|medium|high|critical)/i, '')
        .replace(/(?:low|medium|high|critical)\s+priority/i, '')
        .replace(result.projectName ? new RegExp(result.projectName, 'i') : /xxxx/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Capitalise first letter — take up to 10 words
    if (titleMsg) {
        const words = titleMsg.split(' ').filter(Boolean).slice(0, 10);
        result.title = words.join(' ');
        result.title = result.title.charAt(0).toUpperCase() + result.title.slice(1);
    }

    console.log('[AI] Rule-based fallback extraction:', result);
    return result;
}

// ─────────────────────────────────────────────
// 3. NATURAL LANGUAGE → ISSUE EXTRACTION
// @route POST /api/ai/create-issue
// ─────────────────────────────────────────────
exports.extractIssueData = async (prompt) => {
    const model = getModel();
    if (!model) return { title: prompt, description: prompt };

    const aiPrompt = `
${SYSTEM_PROMPT}

TASK:
Extract structured Jira issue information from the following user request.

USER REQUEST:
"${prompt}"

DETECT IF POSSIBLE
• issue title
• detailed description
• priority
• issue type
• assignee name
• due date

RETURN JSON ONLY

{
  "title": "short issue title",
  "description": "expanded description",
  "priority": "low|medium|high|null",
  "type": "task|bug|story|epic|null",
  "assigneeName": "name or null",
  "dueDate": "ISO date or null"
}
`;

    try {
        const result = await model.generateContent(aiPrompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { title: prompt };
    } catch (error) {
        console.error('Gemini Error (Extract):', error.message || error);
        return { title: prompt }; // Default to using the prompt as title on failure
    }
};


// ─────────────────────────────────────────────
// 4. SPRINT PLANNING
// @route POST /api/ai/sprint-plan
// ─────────────────────────────────────────────
exports.suggestSprintPlan = async (backlog) => {
    const model = getModel();
    if (!model) return { recommendations: [], totalPoints: 0 };

    const prompt = `
${SYSTEM_PROMPT}

TASK:
Select the best issues for the next sprint.

BACKLOG:
${JSON.stringify(backlog.map(i => ({ id: i._id, title: i.title, priority: i.priority, points: i.points })))}

RULES
• prioritize high priority issues
• consider dependencies
• avoid exceeding reasonable sprint capacity
• maximize delivery impact

RETURN JSON ONLY

{
  "recommendations": [
    {
      "issueId": "id",
      "title": "issue title",
      "reason": "why this should be included"
    }
  ],
  "totalPoints": number
}
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { recommendations: [], totalPoints: 0 };
    } catch (error) {
        console.error('Gemini Error (Sprint):', error.message || error);
        return { recommendations: [], totalPoints: 0 }; // Return empty plan on error
    }
};

// ─────────────────────────────────────────────
// 5. COPILOT CHAT
// Tries: Ollama → Gemini 2.5-flash → Gemini 2.0-flash → error message
// ─────────────────────────────────────────────
exports.generateChatResponse = async (message, context) => {

    // ── Build shared context strings ────────────────────────────────
    const historyStr = (context.history || []).map(m => `${m.role}: ${m.content}`).join('\n');
    const stateStr = context.conversationState && Object.keys(context.conversationState).length
        ? `\nAlready collected:\n${JSON.stringify(context.conversationState, null, 2)}`
        : '';

    // ── 1️⃣ Try Ollama first (free, unlimited, local) ───────────────────
    const ollamaPrompt = `${SYSTEM_PROMPT}

Project: ${context.projectName || context.projectId || 'not set'}
User role: ${context.userRole}
Recent issues: ${JSON.stringify(context.recentIssues || [])}
${stateStr}
${historyStr ? `\nConversation so far:\n${historyStr}` : ''}

User: ${message}

You MUST respond with ONLY a valid JSON object matching this schema (no text before or after):
{
  "action": "create_issue|ask_missing_fields|general_chat|estimate_issue|sprint_planning",
  "message": "your conversational reply to the user",
  "missingFields": ["field names still needed, or empty array"],
  "issueData": {
    "title": null,
    "description": null,
    "priority": null,
    "type": null,
    "assigneeName": null,
    "dueDate": null
  } or null
}`;

    try {
        const { text, parsed } = await callOllama(ollamaPrompt, { json: true });
        if (parsed && parsed.action) {
            console.log('[AI] generateChatResponse via Ollama ✓');
            // Normalise the parsed response
            return {
                action: parsed.action || 'general_chat',
                message: parsed.message || text,
                missingFields: parsed.missingFields || [],
                issueData: parsed.issueData || null,
                model: 'ollama/' + OLLAMA_MODEL,
            };
        }
    } catch (err) {
        if (err.isOllamaDown) {
            console.warn('[AI] Ollama not running — falling back to Gemini for chat');
        } else {
            console.error('[AI] Ollama chat error:', err.message);
        }
    }

    // ── 2️⃣ Gemini fallback ────────────────────────────────────────
    const model = getModel();
    if (!model) return {
        action: 'general_chat',
        message: '⚠️ AI is offline. Start Ollama (`ollama serve`) or add a GEMINI_API_KEY to use the copilot.',
        missingFields: [],
        issueData: null,
        model: 'none',
    };

    console.log('[AI] generateChatResponse falling back to Gemini...');



    const systemInstruction = `
${SYSTEM_PROMPT}

You are currently operating inside a Jira-like SaaS called "TaskFlow".

PROJECT CONTEXT
Project ID: ${context.projectId}
User Role: ${context.userRole}

Recent Issues:
${JSON.stringify(context.recentIssues)}

--------------------------------
YOUR CAPABILITIES
--------------------------------

You can help users:
1. Create Issues
2. Break Features into Tasks
3. Estimate Story Points
4. Plan Sprints
5. Analyze Project Backlogs
6. Explain project progress
7. Suggest improvements

--------------------------------
INTERACTION RULES
--------------------------------

If the user asks to create an issue:
→ Merge any field values already present in CONVERSATION STATE.
→ Ask ONLY for fields that are still missing.

If the user provides a feature:
→ Break it into smaller tasks.

If the user asks for estimation:
→ Provide Fibonacci estimate.

If the user asks about backlog:
→ Suggest prioritization.

--------------------------------
IMPORTANT
--------------------------------

You are an advisory AI.
You cannot directly modify the database.
Users must confirm actions through the UI.
Generate insights, recommendations, and structured data.

ALWAYS return a single valid JSON object. Never return plain text.
`;

    // Fix 2 — Structured chat prompt with conversationState + history
    const prompt = `
${systemInstruction}

CONVERSATION STATE (already collected fields — do NOT ask for these again)
${JSON.stringify(context.conversationState || {})}

Conversation History
${historyStr || '(none)'}

User Message:
"${message}"

Determine the user intent and return structured output.
Return JSON ONLY.
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Safely parse the JSON response from Gemini
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        // Fallback if Gemini unexpectedly returns plain text
        return {
            action: 'general_chat',
            message: text,
            missingFields: [],
            issueData: null
        };
    } catch (error) {
        console.error('Gemini SDK Error (Chat):', error);

        const errorMsg = error.message || '';
        const status = error.status || 0;

        // ── 429 Rate Limit: retry once after the suggested delay ─────────────
        if (status === 429 || errorMsg.includes('429') || errorMsg.includes('quota')) {
            // Extract retryDelay from error details (e.g. "3.358173655s" → 4000ms)
            let retryMs = 5000; // safe default
            try {
                const retryInfo = error.errorDetails?.find(d =>
                    d['@type']?.includes('RetryInfo') && d.retryDelay
                );
                if (retryInfo?.retryDelay) {
                    const seconds = parseFloat(retryInfo.retryDelay);
                    if (!isNaN(seconds)) retryMs = Math.ceil(seconds * 1000) + 500;
                }
            } catch (_) { /* ignore parse errors */ }

            console.log(`Rate limited. Retrying in ${retryMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryMs));

            try {
                const retryResult = await model.generateContent(prompt);
                const retryText = retryResult.response.text();
                const retryJson = retryText.match(/\{[\s\S]*\}/);
                if (retryJson) return JSON.parse(retryJson[0]);
                return { action: 'general_chat', message: retryText, missingFields: [], issueData: null };
            } catch (retryError) {
                console.error('Gemini retry also failed:', retryError.message);
                return {
                    action: 'general_chat',
                    message: `🦙 **Ollama is not running** — the AI copilot needs it as a free, unlimited backend.\n\n**Fix it in 3 steps (run in any terminal):**\n\`\`\`\n1. winget install Ollama.Ollama\n2. ollama pull llama3.2:3b\n3. ollama serve\n\`\`\`\n\nOnce Ollama is running, press Retry — no API limits, no cost, works offline.`,
                    missingFields: [],
                    issueData: null
                };
            }
        }

        // ── 403 API disabled or Key Unrestricted ────────────────────────────
        if (status === 403 || errorMsg.includes('403') || errorMsg.includes('disabled')) {
            let customMessage = "My AI brain is currently disabled! Please enable the 'Generative Language API' in Google Cloud Console.";
            if (errorMsg.includes('unrestricted keys')) {
                customMessage = "Your Gemini API key is unrestricted. Please create a restricted key or restrict your current key in Google Cloud Console to restore access.";
            } else if (errorMsg) {
                // Surface the actual error if it's not the generic disabled one, but keep it user friendly
                // customMessage = errorMsg; // Or we can just stick to the custom ones
            }
            return {
                action: 'general_chat',
                message: customMessage,
                missingFields: [],
                issueData: null
            };
        }

        // ── Generic fallback ─────────────────────────────────────────────────
        return {
            action: 'general_chat',
            message: "I'm having trouble connecting to my brain right now. Please try again later.",
            missingFields: [],
            issueData: null
        };
    }
};

// ─────────────────────────────────────────────
// 6. MINUTES OF MEETING GENERATION
// ─────────────────────────────────────────────
exports.generateMOMFromTranscript = async (transcriptText, agenda, participantIds) => {
  try {
    const model = getModel('gemini-1.5-pro'); // Use getModel from factory, fallback will be handled
    if (!model) throw new Error('AI not configured');

    const prompt = `You are an expert meeting note-taker. Analyze the following meeting transcript and generate structured Minutes of Meeting (MOM).

Meeting Agenda: ${agenda || 'General discussion'}

Transcript:
${transcriptText}

Please provide the output ONLY as valid JSON (no markdown formatting, no code blocks, just raw JSON):
{
  "summary": "A 2-3 sentence overview of what was discussed",
  "decisions": [
    "Decision 1",
    "Decision 2"
  ],
  "actionItems": [
    {
      "title": "Brief action item title",
      "description": "More detailed description",
      "assigneeName": "Name of person (from transcript)",
      "priority": "High|Medium|Low",
      "dueDate": "YYYY-MM-DD (estimate based on context)"
    }
  ]
}

Rules:
- Extract only actionable items with clear ownership
- If no assignee is mentioned, assign to the first speaker or leave blank
- Priorities should be inferred from urgency mentioned
- Dates should be estimated from context (e.g., "next week", "by Friday")
- Keep summary concise (2-3 sentences max)
- Include only major decisions`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response (strip markdown if present)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const momData = JSON.parse(jsonMatch[0]);
    return momData;
  } catch (error) {
    console.error('Error generating MOM:', error);
    throw new Error(`Failed to generate MOM: ${error.message}`);
  }
};

// ─────────────────────────────────────────────
// 7. AI RISK DETECTION
// ─────────────────────────────────────────────
exports.analyzeRisk = async (projectData) => {
    try {
        const model = getModel('gemini-1.5-pro'); // Use getModel from factory, fallback will be handled
        if (!model) throw new Error('AI not configured');

        const prompt = `You are an expert Agile Project Manager and Risk Analyst. 
Analyze the following project data and identify potential risks, bottlenecks, and areas of concern.

Project Data:
${JSON.stringify(projectData, null, 2)}

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
}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON response (strip markdown if present)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('Error analyzing risk:', error);
        throw new Error(`Failed to analyze risk: ${error.message}`);
    }
};

exports.transcribeAudioFile = async (buffer, filename) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const { OpenAI } = require('openai');
        
        // Write the buffer to a temporary file
        const tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${filename}`);
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
            language: 'en',
        });
        fs.unlinkSync(tempFilePath); // cleanup
        return response.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
};
