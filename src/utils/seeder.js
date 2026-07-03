const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Sync the SuperAdmin account on every server startup.
 *
 * Logic:
 *  1. Read ADMIN_EMAIL + ADMIN_PASSWORD from .env (with fallbacks).
 *  2. Look for an existing SuperAdmin by roleName.
 *  3. If none exists → create it.
 *  4. If one exists → compare email and password against .env values
 *     and update only the fields that have actually changed.
 *
 * This means:
 *  - Changing ADMIN_EMAIL in .env + restarting → email updates in DB.
 *  - Changing ADMIN_PASSWORD in .env + restarting → password updates in DB.
 *  - No unnecessary writes if nothing changed.
 */
const seedSuperAdmin = async () => {
    try {
        const email = process.env.ADMIN_EMAIL || 'admin@taskflow.com';
        const password = process.env.ADMIN_PASSWORD || 'Admin@123';

        // Find any existing SuperAdmin (by role, not email — in case email changed)
        const existingAdmin = await User.findOne({ roleName: 'SuperAdmin' });

        if (!existingAdmin) {
            // ── First run: create the account ────────────────────────────
            await User.create({
                name: 'System Admin',
                email,
                password,          // pre-save hook will hash this
                roleName: 'SuperAdmin',
                isVerified: true,
            });
            console.log(`[Seed] SuperAdmin created → ${email}`);
            return;
        }

        // ── Account exists: check what needs updating ─────────────────────
        let changed = false;

        // 1. Email changed in .env?
        if (existingAdmin.email !== email) {
            // Make sure no OTHER non-admin user already owns the new email
            const conflict = await User.findOne({ email, _id: { $ne: existingAdmin._id } });
            if (conflict) {
                console.warn(
                    `[Seed] Cannot update SuperAdmin email to "${email}" — already taken by another account.`
                );
            } else {
                console.log(`[Seed] SuperAdmin email updated: ${existingAdmin.email} → ${email}`);
                existingAdmin.email = email;
                changed = true;
            }
        }

        // 2. Password changed in .env?
        //    bcrypt.compare lets us check without re-hashing unnecessarily.
        const passwordMatches = await bcrypt.compare(password, existingAdmin.password);
        if (!passwordMatches) {
            console.log(`[Seed] SuperAdmin password updated (from .env change).`);
            existingAdmin.password = password;  // pre-save hook will hash it
            changed = true;
        }

        // 3. Ensure role is still SuperAdmin (safety net)
        if (existingAdmin.roleName !== 'SuperAdmin') {
            existingAdmin.roleName = 'SuperAdmin';
            changed = true;
        }

        if (changed) {
            await existingAdmin.save();
            console.log(`[Seed] SuperAdmin account synced → ${existingAdmin.email}`);
        } else {
            console.log(`[Seed] SuperAdmin account is up-to-date → ${existingAdmin.email}`);
        }
    } catch (error) {
        console.error('[Seed] Error syncing SuperAdmin:', error.message);
    }
};

module.exports = { seedSuperAdmin };
