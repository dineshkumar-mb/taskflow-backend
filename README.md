# TaskFlow - Backend

A Node.js backend powering an AI-driven, Jira-inspired sprint management SaaS platform with webhook-driven workflows.

## 🚀 What Was Built

A comprehensive SaaS REST API managing projects, sprints, and issues with a robust Role-Based Access Control (RBAC) system. It features an integrated local AI copilot (Ollama/Gemini) that extracts structured issue data from natural language, handles Cashfree subscription billing via webhooks, and orchestrates background automation using n8n.

## 💡 Why It's Technically Interesting

The AI integration prioritizes local, free inference. It runs a local Ollama instance (`llama3.2:3b`) as the primary NLP engine to maintain data privacy and zero cost, with a graceful failover mechanism to Google's Gemini models (`2.5-flash` and `2.0-flash`) if the local server is unavailable.

## 🛠️ Architecture

- **Backend:** Node.js (v20/v22), Express.
- **Database:** MongoDB (via Mongoose) tracking everything from User profiles to Sprint timelines.
- **Billing:** Cashfree Payment Gateway, synchronized asynchronously via webhooks.
- **Automation Pipeline:** Centralized, fire-and-forget webhook dispatcher (`webhook.service.js`) communicating with an external n8n instance.

## The AI Prompt & Data Structure

Rather than native OpenAI function-calling, the backend achieves determinism through structured prompt engineering and Regex-based intent detection (`create_project`, `create_issue`, `estimate_issue`). 

**System Prompt Architecture:**
The AI assumes a hybrid persona (Senior Architect + Scrum Master). When generating an issue summary or estimating story points, it receives a prompt demanding a strict JSON response. Example request flow for `createIssue`:
1. User prompt: "Make a task to implement auth."
2. `ai.controller.js` routes this to the local Ollama instance with `format: 'json'`.
3. The LLM returns a structured JSON payload (`{ title: '...', description: '...', type: 'Task', ... }`).
4. The controller creates the MongoDB `Issue` natively.

## Response Validation & Error Handling

- **LLM Failover:** The `ai.service.js` automatically catches `ECONNREFUSED` or fetch failures on the local Ollama instance and reroutes the payload to Gemini `2.5-flash`. If that hits a rate limit (429), it cascades down to `2.0-flash`.
- **JSON Recovery:** If the LLM returns conversational fluff alongside the JSON, a regex matcher (`/\{[\s\S]*\}/`) strips the markdown and salvages the payload.
- **n8n Resiliency:** Webhooks dispatched to n8n are configured with strict 3-second timeouts in a try/catch block. If n8n is down, the system logs the failure and continues processing the user request uninterrupted, ensuring background automation never breaks the main SaaS experience.

## Getting Started

### Prerequisites
- Node.js v22
- MongoDB
- Local Ollama running (optional, will fallback to Gemini)

### Installation

```bash
git clone https://github.com/dineshkumar-mb/taskflow-backend
cd taskflow-backend
npm install
```

### Running the Server

```bash
npm start
# or for development:
npm run dev
```

## Environment Variables

Create a `.env` file with:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `OLLAMA_BASE_URL` (Defaults to http://localhost:11434)
- `GEMINI_API_KEY`
- `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY`
- `N8N_ISSUE_WEBHOOK` / `N8N_SPRINT_WEBHOOK` (and other n8n routes)

## License
MIT License
