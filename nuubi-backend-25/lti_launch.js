const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const app = express();

// Configure the app
env = process.env;
const PORT = env.PORT || 3000;
const { CLIENT_ID, CLIENT_SECRET, DEPLOYMENT_ID } = env;

app.use(bodyParser.json());

// LTI Launch Endpoint
app.post('/lti-launch', (req, res) => {
    try {
        const { id_token } = req.body;

        // Verify the received token
        const decodedToken = jwt.verify(id_token, CLIENT_SECRET);
        console.log('Decoded Token:', decodedToken);

        if (decodedToken.iss) {
            res.status(200).send({ message: 'LTI Launch Successful' });
        } else {
            res.status(400).send({ error: 'Invalid LTI Launch Request' });
        }
    } catch (err) {
        res.status(500).send({ error: 'Failed Launch', details: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});