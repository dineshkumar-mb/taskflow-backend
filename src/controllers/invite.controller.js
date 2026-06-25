const inviteService = require('../services/invite.service');
const webhookService = require('../services/webhook.service');

const sendInvite = async (req, res) => {
    try {
        const { email, role } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const invite = await inviteService.sendInvite(
            req.user.organizationId,
            req.user._id,
            email,
            role || 'Member'
        );

        res.status(201).json({ message: 'Invitation sent successfully', invite });
        // n8n: fire-and-forget
        webhookService.emit('invite.sent', {
            invite: { id: invite._id, email, role: role || 'Member', organizationId: req.user.organizationId },
            invitedBy: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const acceptInvite = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required' });

        const organization = await inviteService.acceptInvite(token, req.user._id);
        res.json({ message: 'Invitation accepted successfully', organization });
        // n8n: fire-and-forget
        webhookService.emit('invite.accepted', {
            organization: { id: organization._id, name: organization.name },
            newMember: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    sendInvite,
    acceptInvite,
};
