const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Organization = require('../src/models/Organization');
const Project = require('../src/models/Project');
const Sprint = require('../src/models/Sprint');
const Issue = require('../src/models/Issue');
const Board = require('../src/models/Board');

async function seed() {
    try {
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI is not defined in .env');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        // 1. Find a user to be the lead/owner
        const user = await User.findOne();
        if (!user) {
            console.error('No users found in database. Please register a user first.');
            process.exit(1);
        }
        console.log(`Using user: ${user.email}`);

        // 2. Ensure org exists
        let orgId = user.organizationId;
        if (!orgId) {
            const org = await Organization.create({
                name: 'Demo Org',
                owner: user._id,
                members: [{ user: user._id, role: 'Owner' }]
            });
            orgId = org._id;
            user.organizationId = orgId;
            user.role = 'Owner';
            await user.save();
        }

        // 3. Create Project
        const project = await Project.create({
            name: 'Demo Project',
            key: 'DEMO',
            organization: orgId,
            lead: user._id,
            members: [user._id],
            description: 'A walkthrough project to showcase Jira features like Sprints, Backlog, and AI estimations.'
        });
        console.log(`Project created: ${project.key}`);

        // 4. Create Board
        const board = await Board.create({
            name: 'DEMO Kanban Board',
            project: project._id,
            columns: [
                { name: 'To Do', status: 'todo', position: 0 },
                { name: 'In Progress', status: 'in-progress', position: 1 },
                { name: 'Done', status: 'done', position: 2 }
            ]
        });

        // 5. Create Sprints
        const sprint1 = await Sprint.create({
            name: 'Sprint 1 - Foundation',
            project: project._id,
            board: board._id,
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        });

        const sprint2 = await Sprint.create({
            name: 'Sprint 2 - Refinement',
            project: project._id,
            board: board._id,
            status: 'future',
            startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000)
        });

        // 6. Create Issues
        const issues = [
            // Sprint 1
            { title: 'Setup project architecture', type: 'task', status: 'done', sprint: sprint1._id, position: 0 },
            { title: 'Implement user login flow', type: 'story', status: 'in-progress', sprint: sprint1._id, position: 0, storyPoints: 5 },
            { title: 'Fix CSS alignment on board', type: 'bug', status: 'todo', sprint: sprint1._id, position: 1, priority: 'high' },
            { title: 'Research AI estimation models', type: 'story', status: 'todo', sprint: sprint1._id, position: 2, storyPoints: 3 },

            // Sprint 2 (Future)
            { title: 'Mobile responsive views', type: 'task', status: 'todo', sprint: sprint2._id, position: 0, storyPoints: 8 },
            { title: 'Advanced JQL filtering', type: 'story', status: 'todo', sprint: sprint2._id, position: 1, storyPoints: 13 },

            // Backlog
            { title: 'External API integration', type: 'epic', status: 'todo', position: 0 },
            { title: 'Dark mode theme toggle', type: 'story', status: 'todo', position: 1, storyPoints: 2 },
            { title: 'Unit test dashboard components', type: 'task', status: 'todo', position: 2 },
            { title: 'Update documentation', type: 'task', status: 'todo', position: 3 },
        ];

        for (let i = 0; i < issues.length; i++) {
            const issueData = issues[i];
            await Issue.create({
                ...issueData,
                key: `${project.key}-${i + 1}`,
                project: project._id,
                reporter: user._id,
                assignee: user._id
            });
        }

        console.log('Successfully seeded demo project, board, 2 sprints, and 10 issues.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seed();
