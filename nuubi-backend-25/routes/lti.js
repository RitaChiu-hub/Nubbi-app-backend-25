const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

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
  const roles = payload["https://purl.imsglobal.org/spec/lti/claim/roles"];
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

module.exports = router;
