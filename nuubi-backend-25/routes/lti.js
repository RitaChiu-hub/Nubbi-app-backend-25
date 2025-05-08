const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const pool = require("../db");

/* ────────────────────────────── 1. OIDC login ───────────────────────────── */
router.all("/login", express.urlencoded({ extended: false }), (req, res) => {
  console.log("📥 LTI login-init hit");

  const p = req.method === "POST" ? req.body : req.query;
  const { client_id, login_hint, lti_message_hint, target_link_uri } = p;

  const iss = "https://stthomas.beta.instructure.com"; // << fixed issuer
  const redirect =
    `${iss}/api/lti/authorize_redirect?` +
    `client_id=${client_id}&` +
    `login_hint=${login_hint}&` +
    `lti_message_hint=${lti_message_hint}&` +
    `redirect_uri=${encodeURIComponent(target_link_uri)}&` +
    `response_type=id_token&response_mode=form_post&scope=openid&` +
    `state=state123&nonce=nonce123&prompt=none`;

  console.log("↪ redirecting to Canvas authorize_redirect");
  /* *stay in iframe* – we only move the *iframe* to Canvas, not window.top */
  res.send(`
    <html><head><title>Redirecting…</title></head>
    <body onload="location.replace('${redirect}')"></body></html>
  `);
});

/* ────────────────────────────── 2. LTI launch ───────────────────────────── */
router.post("/launch", express.urlencoded({ extended: false }), (req, res) => {
  console.log("🚀 LTI launch hit");

  const idToken = req.body.id_token;
  if (!idToken) return res.status(400).send("Missing id_token");

  /* ───── quick peek (DEBUG ONLY – no signature check) ───── */
  const decoded = jwt.decode(idToken, { complete: true });
  console.log("[Nuubi] — header —");
  console.log(JSON.stringify(decoded.header, null, 2));
  console.log("[Nuubi] — payload / claims —");
  console.log(JSON.stringify(decoded.payload, null, 2));

  // Fix: assign payload from decoded
  const payload = decoded.payload;

  const roles =
    payload["https://purl.imsglobal.org/spec/lti/claim/roles"] || [];
  const isAdmin = roles.some(
    (role) => role.includes("Instructor") || role === "Administrator"
  );

  console.log("is Instructor? (isAdmin?) : " + isAdmin);

  /* (optional) inspect token … */
  const nuubiURL = `https://www.nuubi.app/lti-login?token=${encodeURIComponent(
    idToken
  )}`;

  /* send the page that embeds Nuubi inside the Canvas iframe */
  res.status(200).send(`
      <html>
        <head>
          <title>Loading Nuubi…</title>
          <style>body{margin:0}</style>
        </head>
        <body>
          <iframe src="${nuubiURL}"
                  style="border:0;width:100%;height:100vh;"
                  title="Nuubi LTI App">
          </iframe>
        </body>
      </html>
    `);
});

// POST /api/lti/session
router.post("/session", async (req, res) => {
  const { id_token } = req.body;

  if (!id_token) {
    return res.status(400).json({ error: "Missing id_token" });
  }

  try {
    // Decode without verifying (for now – upgrade to verified version later)
    const decoded = jwt.decode(id_token);
    const payload = decoded;

    const email = payload.email;
    const roles =
      payload["https://purl.imsglobal.org/spec/lti/claim/roles"] || [];
    const isAdmin = roles.some(
      (role) => role.includes("Instructor") || role === "Administrator"
    );

    // Check if user exists
    let userRes = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    // If user does not exist, create one
    if (userRes.rows.length === 0) {
      const username = email.split("@")[0] + Math.floor(Math.random() * 10000);

      await pool.query(
        `INSERT INTO users (email, username, passhash, created_via_canvas)
           VALUES ($1, $2, $3, $4)`,
        [email, username, null, true]
      );

      userRes = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
    }

    const user = userRes.rows[0];

    // Issue your Nuubi JWT
    const nuubiToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    );

    // Set cookie (for web)
    res.cookie("token", nuubiToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000 * 365, // 1 year
      path: "/",
    });

    // Return token for mobile, and metadata
    return res.json({
      success: true,
      token: nuubiToken,
      isAdmin,
      email: user.email,
    });
  } catch (err) {
    console.error("LTI session error:", err);
    return res.status(500).json({ error: "Failed to process LTI session" });
  }
});

module.exports = router;
