const Invitation = require('../models/Invitation');
const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const sendInvite = async (organizationId, senderId, email, role) => {
    // Generate token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation in DB
    const invite = await Invitation.create({
        email,
        organization: organizationId,
        invitedBy: senderId,
        role,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Send email (Mocking for now, will use nodemailer if configured)
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const inviteUrl = `${process.env.CLIENT_URL}/accept-invite?token=${token}`;

    const mailOptions = {
        from: `"TaskFlow" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'You have been invited to join an organization on TaskFlow',
        html: `
            <h1>TaskFlow Invitation</h1>
            <p>You have been invited with the role of <strong>${role}</strong>.</p>
            <p>Click the link below to accept the invitation:</p>
            <a href="${inviteUrl}">${inviteUrl}</a>
            <p>This link will expire in 7 days.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending invite email:', error);
        // We still keep the invite in DB so user can accept via token if provided manually
    }

    return invite;
};

const acceptInvite = async (token, userId) => {
    const invite = await Invitation.findOne({ token, status: 'pending' });
    if (!invite) throw new Error('Invalid or expired invitation token');

    if (invite.expiresAt < new Date()) {
        invite.status = 'expired';
        await invite.save();
        throw new Error('Invitation has expired');
    }

    const organization = await Organization.findById(invite.organization);
    if (!organization) throw new Error('Organization not found');

    // Create OrganizationMember record
    const existingMember = await OrganizationMember.findOne({
        organization: invite.organization,
        user: userId
    });

    if (!existingMember) {
        await OrganizationMember.create({
            organization: invite.organization,
            user: userId,
            role: invite.role,
            status: 'active'
        });
    } else {
        existingMember.status = 'active';
        existingMember.role = invite.role;
        await existingMember.save();
    }

    // Update user record
    await User.findByIdAndUpdate(userId, {
        organizationId: invite.organization,
        organization: invite.organization,
        role: invite.role,
    });

    // Mark invite as accepted
    invite.status = 'accepted';
    await invite.save();

    return organization;
};

module.exports = {
    sendInvite,
    acceptInvite,
};

