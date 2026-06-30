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

## Structured Function-Calling Layer

To translate natural-language commands into deterministic backend actions, the AI copilot leverages a **structured function-calling layer** (following the OpenAI tool-calling specification). This allows the LLM to map user intent directly to specific backend functions with validated schemas.

**Defined Tools / Functions:**
The backend defines a suite of JSON Schema tools, including:
- `createTask`: Extracts title, description, assignee, and priority from the prompt to generate a new Jira-style issue.
- `moveDeadline`: Identifies task IDs and parsed date entities to adjust sprint timelines.
- `estimate_issue`: Analyzes the complexity of a task to assign story points.

**Example Request Flow:**
1. **User prompt:** "Make a task to implement auth and assign it to John."
2. **LLM Routing:** `ai.controller.js` sends the prompt and the tool schemas to the model (acting as a function-calling endpoint).
3. **Tool Invocation:** The LLM returns a structured tool call payload:
   ```json
   {
     "name": "createTask",
     "arguments": {
       "title": "Implement Authentication",
       "assignee": "John",
       "type": "Task"
     }
   }
   ```
4. **Execution:** The backend validates the arguments, triggers the corresponding controller logic to create the MongoDB `Issue`, and returns the success status to the client.

## Response Validation & Error Handling

- **LLM Failover:** The `ai.service.js` automatically catches `ECONNREFUSED` or fetch failures on the primary model instance and reroutes the payload to fallback models (e.g., Gemini `2.5-flash`). If that hits a rate limit (429), it cascades down to `2.0-flash`.
- **Function-Call Recovery:** If the LLM hallucinates an undefined function or provides arguments that fail schema validation, a fallback logic layer catches the mismatch, attempts a single deterministic retry, and finally returns a safe error to the client if needed.
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
