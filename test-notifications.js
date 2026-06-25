require('dotenv').config();
const mongoose = require('mongoose');
const notificationService = require('./src/services/notification.service');

async function testNotification() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // These need to be valid ObjectIds from the database
    // We'll just create dummy objects that mimic Mongoose documents
    // to test the structure logic without actually saving to DB for now.

    // Instead of full DB lookup, let's just test our sendWhatsApp utility standalone
    const { sendWhatsAppAssignment } = require('./src/utils/sendWhatsApp');
    const sendEmail = require('./src/utils/sendEmail');

    console.log('\n--- Testing WhatsApp Payload ---');
    const dummyIssue = {
        key: 'TEST-123',
        title: 'Implement Notification System',
        type: 'task',
        priority: 'high',
        status: 'todo',
        project: 'PROJECTID123'
    };

    const dummyAssignee = { name: 'Dinesh Kumar', email: process.env.EMAIL_USER, phone: process.env.TEST_WHATSAPP_NUMBER || '+1234567890' };
    const dummyReporter = { name: 'AI Copilot' };
    const clientUrl = 'http://localhost:5173';

    // Test WhatsApp
    await sendWhatsAppAssignment(dummyIssue, dummyAssignee, dummyReporter, clientUrl);

    // Test Email payload (dry run)
    console.log('\n--- Email test simulation ---');
    console.log(`To: ${dummyAssignee.email}`);
    console.log("Subject: [TaskFlow] You've been assigned to TEST-123");

    console.log('\nAll tests ran successfully!');
    process.exit(0);
}

testNotification().catch(console.error);
