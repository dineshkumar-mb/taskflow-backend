const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Configure Passport Google Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
            callbackURL: '/api/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists
                let user = await User.findOne({ email: profile.emails[0].value });

                if (!user) {
                    // Create new user via Google
                    user = await User.create({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        password: 'google-oauth-placeholder-password', // Required by schema
                        authProvider: 'google',
                        avatar: profile.photos[0]?.value || '',
                        role: 'Viewer' // Default role
                    });
                } else if (!user.authProvider) {
                    // Link existing email to Google Auth
                    user.authProvider = 'google';
                    if (!user.avatar) user.avatar = profile.photos[0]?.value;
                    await user.save();
                }

                return done(null, user);
            } catch (error) {
                console.error('Google OAuth Error:', error);
                return done(error, null);
            }
        }
    )
);

// We aren't using session serialization as we use stateless JWTs
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
