const express = require('express');
const axios = require('axios');
const app = express();

env = process.env;
const PORT = env.PORT || 3000;
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = env;

// Base URL for Canvas OAuth flow
const CANVAS_BASE_URL = 'https://canvas.instructure.com';

// Step 1: Redirect to Canvas OAuth login
app.get('/oauth/login', (req, res) => {
    const authUrl = `${CANVAS_BASE_URL}/login/oauth2/auth?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}`;
    res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post(`${CANVAS_BASE_URL}/login/oauth2/token`, {
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        });

        const accessToken = tokenResponse.data.access_token;
        res.json({ message: 'OAuth Successful', accessToken });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`OAuth server running on http://localhost:${PORT}`);
});