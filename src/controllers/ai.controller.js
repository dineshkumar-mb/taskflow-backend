const aiService = require('../services/ai.service');
const Issue = require('../models/Issue');
const Project = require('../models/Project');
const User = require('../models/User');
const projectService = require('../services/project.service');
const webhookService = require('../services/webhook.service');

// ─────────────────────────────────────────────
// Fix 4 — Intent Detection
// Runs before calling Gemini to reduce hallucination
// ─────────────────────────────────────────────
function detectIntent(message) {
    const msg = message.toLowerCase();

    if (msg.match(/\b(create|add|make|new|build)\b/) && msg.match(/\b(project|workspace)\b/)) {
        return 'create_project';
    }

    if (msg.match(/\b(create|add|make|new|build|implement|develop)\b/) &&
        msg.match(/\b(task|issue|bug|story|epic|ticket|feature)\b/)) {
        return 'create_issue';
    }
    if (msg.match(/\b(estimate|points|story point|effort|complexity|how long|how much)\b/)) {
        return 'estimate_issue';
    }
    if (msg.match(/\b(sprint|backlog|plan|prioritiz|capacity|next sprint)\b/)) {
        return 'sprint_planning';
    }

    return 'general_chat';
}

// ─────────────────────────────────────────────
// Extract a project name hint from the message
// Handles: "project is ide", "in the ide project", "for ide project"
// ─────────────────────────────────────────────
function extractProjectNameHint(message) {
    const patterns = [
        /project\s+is\s+['"]?([\w\s]+?)['"]?(?:\s|$)/i,
        /['"]?([\w\s]+?)['"]?\s+project/i,
        /for\s+(?:the\s+)?['"]?([\w\s]+?)['"]?\s+project/i,
        /in\s+(?:the\s+)?['"]?([\w\s]+?)['"]?\s+project/i,
    ];
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) return match[1].trim();
    }
    return null;
}

// @desc    Generate an AI Issue Summary
// @route   POST /api/ai/summary
const generateSummary = async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title) return res.status(400).json({ message: 'Title is required' });

        const result = await aiService.generateIssueSummary(title, description);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Estimate Story Points
// @route   POST /api/ai/estimate
const estimatePoints = async (req, res) => {
    try {
        const { title, description, type, priority } = req.body;
        const result = await aiService.estimateStoryPoints(title, description, type, priority);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create Issue from Natural Language
// @route   POST /api/ai/create-issue
const createIssueFromPrompt = async (req, res) => {
    try {
        const { prompt, projectId } = req.body;
        if (!prompt || !projectId) return res.status(400).json({ message: 'Prompt and ProjectId are required' });

        const extractedData = await aiService.extractIssueData(prompt);

        const newIssue = await Issue.create({
            title: extractedData.title,
            description: extractedData.description,
            type: extractedData.type,
            priority: extractedData.priority,
            project: projectId,
            reporter: req.user._id,
            dueDate: extractedData.dueDate
        });

        res.status(201).json(newIssue);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get AI Sprint Recommendations
// @route   POST /api/ai/sprint-plan
const getSprintPlan = async (req, res) => {
    try {
        const { projectId } = req.body;
        const backlog = await Issue.find({ project: projectId, sprint: null });

        const plan = await aiService.suggestSprintPlan(backlog);
        res.status(200).json(plan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    AI Copilot Chat  (Fix 3, 4, 5)
// @route   POST /api/ai/copilot
//
// Body:
//   message          – user's text input
//   projectId        – optional Mongo ID of current project
//   conversationState – { title, description, priority, type } collected so far
//   history          – [{ role, content }] previous turns
//
// Flow:
//   1. Detect intent via detectIntent()
//   2. Fetch project issues for context
//   3. Build full context object (Fix 3: merge conversationState)
//   4. Call Gemini → get structured JSON (ACTION ENGINE)
//   5. If action === "create_issue" → auto-save to DB (Fix 5)
//   6. Return structured response to frontend
// ─────────────────────────────────────────────────────────────────────────────
const copilotChat = async (req, res) => {
    try {
        const {
            message,
            projectId,
            conversationState = {},
            history = []
        } = req.body;

        console.log('AI Copilot Request:', { message, projectId, conversationState });

        // ── Step 1: Fetch all org projects (used for both resolution & UX) ────
        const orgProjects = req.user.organizationId
            ? await Project.find({ organization: req.user.organizationId }).select('_id name key')
            : [];

        // ── Step 2: Resolve project ID ────────────────────────────────────────
        // Priority:
        //   1. Direct projectId from frontend (user is inside a project screen)
        //   2. conversationState.projectId (resolved in an earlier turn)
        //   3. AI extraction from current message → DB match
        //   4. conversationState.projectName → DB match
        let resolvedProjectId = (projectId && projectId !== 'undefined') ? projectId : (conversationState.projectId || null);
        let resolvedProjectName = conversationState.projectName || null;

        // Run AI extraction on every create_issue turn to capture project + fields
        const detectedIntent = detectIntent(message);
        let aiExtracted = {};

        if (!resolvedProjectId && detectedIntent === 'create_issue') {
            // AI-based structured extraction replaces the broken regex
            aiExtracted = await aiService.extractStructuredIssueData(message, orgProjects);
            console.log('[Copilot] AI extracted fields:', aiExtracted);

            const nameToLookup = aiExtracted.projectName || resolvedProjectName;
            if (nameToLookup) {
                const found = orgProjects.find(
                    p => p.name.toLowerCase().includes(nameToLookup.toLowerCase()) ||
                        nameToLookup.toLowerCase().includes(p.name.toLowerCase())
                );
                if (found) {
                    resolvedProjectId = found._id.toString();
                    resolvedProjectName = found.name;
                    console.log(`[Copilot] Resolved project "${nameToLookup}" → ${resolvedProjectId} (${resolvedProjectName})`);
                } else {
                    console.log(`[Copilot] No project matched "${nameToLookup}"`);
                }
            }
        } else if (resolvedProjectId) {
            // Already have project ID — still extract other fields to merge
            if (detectedIntent === 'create_issue') {
                aiExtracted = await aiService.extractStructuredIssueData(message, orgProjects);
                console.log('[Copilot] AI extracted additional fields:', aiExtracted);
            }
        }

        const validProjectId = resolvedProjectId &&
            resolvedProjectId !== 'no-project-context' &&
            resolvedProjectId.match(/^[0-9a-fA-F]{24}$/);

        // ── Step 3: Fetch recent issues for AI context ────────────────────────
        let issues = [];
        if (validProjectId) {
            issues = await Issue.find({ project: resolvedProjectId }).limit(10);
        }

        // ── Step 4: Build merged conversationState ────────────────────────────
        // Merge: existing state + AI-extracted fields (non-null wins)
        const mergedState = {
            ...conversationState,
            ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
            ...(resolvedProjectName ? { projectName: resolvedProjectName } : {}),
            // AI-extracted fields fill in any blanks
            ...(aiExtracted.title && !conversationState.title ? { title: aiExtracted.title } : {}),
            ...(aiExtracted.priority && !conversationState.priority ? { priority: aiExtracted.priority } : {}),
            ...(aiExtracted.issueType && !conversationState.type ? { type: aiExtracted.issueType } : {}),
            ...(aiExtracted.assignee && !conversationState.assignee ? { assignee: aiExtracted.assignee } : {}),
        };

        console.log('Detected Intent:', detectedIntent);

        const context = {
            projectId: resolvedProjectId || 'no-project-context',
            projectName: resolvedProjectName || null,
            recentIssues: issues.map(i => ({ title: i.title, status: i.status, priority: i.priority })),
            userRole: req.user.role,
            conversationState: mergedState,
            history,
            detectedIntent,
        };

        // ── Auto-fill defaults for missing fields to simplify issue creation ──
        if (detectedIntent === 'create_issue' && !mergedState.title) {
            // Clean up common action words for a better default title
            let defaultTitle = message.replace(/^(create|add|make|new)\s+(a\s+|an\s+|the\s+)?/i, '').trim();
            mergedState.title = defaultTitle || message;
        }

        if (mergedState.title) {
            mergedState.description = mergedState.description || mergedState.title;
            mergedState.priority = mergedState.priority || 'medium';
            mergedState.type = mergedState.type || 'task';
        }

        // ── Step 5: SHORTCUT — Skip Gemini if all data is already known ────────
        const stateHasAllFields =
            mergedState.title &&
            mergedState.description &&
            mergedState.priority &&
            mergedState.type;

        if (stateHasAllFields && validProjectId) {
            console.log('Shortcut: All fields in conversationState — skipping Gemini call.');
            try {
                const newIssue = await Issue.create({
                    title: mergedState.title,
                    description: mergedState.description,
                    priority: mergedState.priority.toLowerCase(),
                    type: mergedState.type.toLowerCase(),
                    project: resolvedProjectId,
                    reporter: req.user._id,
                    organization: req.user.organizationId,
                    position: 0,
                    status: 'todo',
                });
                console.log('Shortcut auto-created issue:', newIssue._id);
                webhookService.emit('ai.issue_created', {
                    issue: { id: newIssue._id, title: newIssue.title, type: newIssue.type, priority: newIssue.priority, project: newIssue.project },
                    source: 'shortcut',
                    reporter: { id: req.user._id, email: req.user.email, name: req.user.name },
                });
                return res.status(200).json({
                    action: 'create_issue',
                    message: `✅ Issue **"${newIssue.title}"** created successfully in **${resolvedProjectName || 'the project'}**!`,
                    missingFields: [],
                    issueData: mergedState,
                    createdIssue: newIssue,
                    updatedConversationState: {},
                });
            } catch (dbError) {
                console.error('Shortcut issue creation failed:', dbError.message);
            }
        }

        // ── Step 6: Call Gemini (ACTION ENGINE) ───────────────────────────────
        const aiResponse = await aiService.generateChatResponse(message, context);

        // Always echo back updated conversationState so frontend can persist it
        aiResponse.updatedConversationState = mergedState;

        // ── Step 7: Auto-create issue when all fields ready ───────────────────
        const issueReady =
            aiResponse.action === 'create_issue' &&
            aiResponse.issueData &&
            aiResponse.issueData.title &&
            aiResponse.issueData.description &&
            aiResponse.issueData.priority &&
            aiResponse.issueData.type;

        if (issueReady && validProjectId) {
            try {
                const newIssue = await Issue.create({
                    title: aiResponse.issueData.title,
                    description: aiResponse.issueData.description,
                    priority: aiResponse.issueData.priority.toLowerCase(),
                    type: aiResponse.issueData.type.toLowerCase(),
                    project: resolvedProjectId,
                    reporter: req.user._id,
                    organization: req.user.organizationId,
                    position: 0,
                    status: 'todo',
                });
                console.log('AI auto-created issue:', newIssue._id);
                aiResponse.createdIssue = newIssue;
                webhookService.emit('ai.issue_created', {
                    issue: { id: newIssue._id, title: newIssue.title, type: newIssue.type, priority: newIssue.priority, project: newIssue.project },
                    source: 'gemini',
                    reporter: { id: req.user._id, email: req.user.email, name: req.user.name },
                });
                aiResponse.updatedConversationState = {};
            } catch (dbError) {
                console.error('Failed to auto-create issue from AI:', dbError.message);
                aiResponse.dbError = 'Issue detected but could not be saved: ' + dbError.message;
            }
        } else if (aiResponse.action === 'create_project' && aiResponse.projectData && aiResponse.projectData.name) {
            // ── Step 8: Auto-create project ───────────────────
            try {
                const projectKey = aiResponse.projectData.key || aiResponse.projectData.name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
                const newProject = await projectService.createProject(
                    req.user._id,
                    req.user.organizationId,
                    { name: aiResponse.projectData.name, key: projectKey }
                );
                console.log('AI auto-created project:', newProject._id);
                aiResponse.message = `✅ Project **"${newProject.name}"** created successfully!`;
                aiResponse.createdProject = newProject;
                aiResponse.updatedConversationState = {};
            } catch (dbError) {
                console.error('Failed to auto-create project from AI:', dbError.message);
                aiResponse.dbError = 'Project detected but could not be saved: ' + dbError.message;
                aiResponse.message = `❌ Failed to create project: ${dbError.message}`;
            }
        } else if (issueReady && !validProjectId) {
            // ── Smart missing-project UX ─────────────────────────────────────
            // Show available projects instead of a generic message
            const projectList = orgProjects.length
                ? orgProjects.map(p => `• ${p.name}`).join('\n')
                : '(no projects found — create one first)';

            aiResponse.action = 'ask_missing_fields';
            aiResponse.missingFields = ['projectName'];
            aiResponse.message = `I have all the issue details ready, but I need to know which project to create it in.\n\n**Your projects:**\n${projectList}\n\nReply with the project name, e.g. _"add it to IDE Project"_`;
            aiResponse.availableProjects = orgProjects.map(p => ({ id: p._id, name: p.name, key: p.key }));
        }

        // If project is not resolved at all, also surface project list
        if (!validProjectId && aiResponse.action === 'ask_missing_fields' &&
            aiResponse.missingFields?.includes('projectName') && orgProjects.length &&
            !aiResponse.availableProjects) {
            aiResponse.availableProjects = orgProjects.map(p => ({ id: p._id, name: p.name, key: p.key }));
        }

        res.status(200).json(aiResponse);
    } catch (error) {
        console.error('AI Copilot Controller Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generateSummary,
    estimatePoints,
    createIssueFromPrompt,
    getSprintPlan,
    copilotChat
};

