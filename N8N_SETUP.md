# Setup Guide: n8n Automation for TaskFlow

This guide explains how to spin up n8n and connect it to your TaskFlow backend using the provided workflow JSON.

## 1. Start n8n Locally

The easiest way to run n8n for development is via Docker. Run this command in your terminal:

```bash
docker run -d -p 5678:5678 -v ~/.n8n:/home/node/.n8n -e N8N_SECURE_COOKIE="false" --name n8n n8nio/n8n
```

Once running, navigate to **http://localhost:5678** and set up your local admin account.

## 2. Import the Workflow

1. In the n8n UI, go to **Workflows > Add Workflow**.
2. Click the meatball menu (three dots) in the top-right corner and select **Import from File**.
3. Select `taskflow-n8n-workflow.json` located at the root of your Jira project folder.
4. You will see the visual nodes populate on the canvas!

## 3. Configure Credentials (SMTP/Slack)

Currently, the workflow uses placeholder Email nodes.
- To use an actual email sender, double-click the **Mock Send Email (SMTP)** node.
- Click **Add Credential** and provide your SMTP details (e.g., SendGrid, Gmail App Password, AWS SES).
- Alternatively, you can delete the Email node and drag in a **Slack** node to route messages to a team channel instead.

## 4. Activate the Webhooks

Double-click on the "Webhook - Issues", "Webhook - Sprints", etc. nodes.
- Copy the **Test URL** or **Production URL**.
- Both the `.env` variables and the n8n nodes are predefined to use `http://localhost:5678/webhook/taskflow-issues` etc., so they should match perfectly out-of-the-box if you use the Production URL.
- Toggle the workflow **Active** in the top right corner.

## 5. Test it Out!

1. Create a new issue in the TaskFlow React UI.
2. The `issue.controller.js` will emit an event to the `webhook.service.js`.
3. The service posts silently to `http://localhost:5678/webhook/taskflow-issues`.
4. n8n catches the webhook, formats the message, and sends the notification!
