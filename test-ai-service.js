require('dotenv').config();
const fs = require('fs');
const aiService = require('./src/services/ai.service');

async function testGenerateChatResponse() {
    try {
        const message = "create a project named demo and assign task to nandhini";
        const context = {
            projectId: "no-project-context",
            recentIssues: [],
            userRole: "OrgOwner"
        };

        console.log("Calling generateChatResponse...");
        const response = await aiService.generateChatResponse(message, context);
        fs.writeFileSync('log.txt', "RESPONSE RECIEVED:\n" + JSON.stringify(response, null, 2));
    } catch (error) {
        fs.writeFileSync('log.txt', "SCRIPT FAILED:\n" + error.message + "\n" + error.stack);
    }
}

testGenerateChatResponse();
