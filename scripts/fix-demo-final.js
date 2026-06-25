const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Organization = require('../src/models/Organization');
const Issue = require('../src/models/Issue');
const Sprint = require('../src/models/Sprint');
const Board = require('../src/models/Board');

async function fix() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // 1. Identify Target User
        const user = await User.findOne({ email: 'dineshkumar@innotrat.in' });
        if (!user) {
            console.error('Target user dineshkumar@innotrat.in not found');
            process.exit(1);
        }
        const orgId = user.organizationId;
        console.log(`Targeting User: ${user.name}, Org ID: ${orgId}`);

        // 2. Cleanup all existing "Demo Project" instances globally to start fresh
        const demoProjects = await Project.find({ key: 'DEMO' });
        console.log(`Found ${demoProjects.length} existing Demo Projects. Cleaning up...`);

        for (const p of demoProjects) {
            await Issue.deleteMany({ project: p._id });
            await Sprint.deleteMany({ project: p._id });
            await Board.deleteMany({ project: p._id });
            await Organization.updateMany({}, { $pull: { projects: p._id } });
            await p.deleteOne();
        }
        console.log('Cleanup complete.');

        // 3. Re-run seeding logic but targeted to this specific user/org
        console.log('Seeding new Demo Project for dineshkumar@innotrat.in...');

        const project = await Project.create({
            name: 'Demo Project',
            key: 'DEMO',
            organization: orgId,
            lead: user._id,
            members: [user._id],
            description: 'A walkthrough project to showcase Jira features like Sprints, Backlog, and AI estimations.'
        });

        const board = await Board.create({
            name: 'DEMO Kanban Board',
            project: project._id,
            columns: [
                { name: 'To Do', status: 'todo', position: 0 },
                { name: 'In Progress', status: 'in-progress', position: 1 },
                { name: 'Done', status: 'done', position: 2 }
            ]
        });

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

        const issues = [
            { title: 'Setup project architecture', type: 'task', status: 'done', sprint: sprint1._id, position: 0 },
            { title: 'Implement user login flow', type: 'story', status: 'in-progress', sprint: sprint1._id, position: 0, storyPoints: 5 },
            { title: 'Fix CSS alignment on board', type: 'bug', status: 'todo', sprint: sprint1._id, position: 1, priority: 'high' },
            { title: 'Research AI estimation models', type: 'story', status: 'todo', sprint: sprint1._id, position: 2, storyPoints: 3 },
            { title: 'Mobile responsive views', type: 'task', status: 'todo', sprint: sprint2._id, position: 0, storyPoints: 8 },
            { title: 'Advanced JQL filtering', type: 'story', status: 'todo', sprint: sprint2._id, position: 1, storyPoints: 13 },
            { title: 'External API integration', type: 'epic', status: 'todo', position: 0 },
            { title: 'Dark mode theme toggle', type: 'story', status: 'todo', position: 1, storyPoints: 2 },
            { title: 'Unit test dashboard components', type: 'task', status: 'todo', position: 2 },
            { title: 'Update documentation', type: 'task', status: 'todo', position: 3 },
        ];

        for (let i = 0; i < issues.length; i++) {
            await Issue.create({
                ...issues[i],
                key: `${project.key}-${i + 1}`,
                project: project._id,
                reporter: user._id,
                assignee: user._id
            });
        }

        // Add project to organization
        await Organization.findByIdAndUpdate(orgId, {
            $push: { projects: project._id }
        });

        console.log('Successfully seeded fixed demo project.');
        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

fix();
