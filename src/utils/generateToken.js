const jwt = require('jsonwebtoken');

const generateToken = (res, user) => {
    // Generate both tokens via the Mongoose instance methods
    const accessToken = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();

    // Access Token Cookie (15 Mins)
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
    });

    // Refresh Token Cookie (7 Days)
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return the access token string just in case the client needs it (though HttpOnly is preferred)
    return { accessToken, refreshToken };
};

module.exports = generateToken;
