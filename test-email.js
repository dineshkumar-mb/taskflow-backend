require('dotenv').config();
const { sendEmail } = require('./src/services/email.service');

(async () => {
    try {
        await sendEmail({
            to: process.env.EMAIL_USER,
            subject: 'Test Email from TaskFlow',
            html: '<p>This is a test email to verify SMTP configuration.</p>'
        });
        console.log('✅ Test email sent successfully to', process.env.EMAIL_USER);
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        console.error(error);
    }
})();
