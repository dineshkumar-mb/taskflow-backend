const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendEmail = async ({ to, subject, html, text }) => {
  return transporter.sendMail({
    from: `"TaskFlow Notifications" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text
  });
};
