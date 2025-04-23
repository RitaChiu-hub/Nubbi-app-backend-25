const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db"); // Adjust based on your project structure
const router = express.Router();

// 🔹 1. LTI Login Initiation
router.all("/lti/login", (req, res) => {
  const { iss, login_hint, target_link_uri, lti_message_hint, client_id } =
    req.method === "POST" ? req.body : req.query;

  const redirect =
    `${iss}/auth/login?` +
    `client_id=${client_id}&` +
    `login_hint=${login_hint}&` +
    `lti_message_hint=${lti_message_hint}&` +
    `redirect_uri=${encodeURIComponent(target_link_uri)}&` +
    `response_type=id_token&` +
    `response_mode=form_post&` +
    `scope=openid&` +
    `state=state123&` +
    `nonce=nonce123`;

  console.log("Redirecting to Canvas OIDC:", redirect);
  res.redirect(redirect);
});

// router.post("/lti/launch", (req, res) => {
//   console.log("LTI Launch hit!");
//   res.send("<h2>Nuubi LTI Launch received. Setup in progress.</h2>");
// });

router.post(
  "/lti/launch",
  express.urlencoded({ extended: false }),
  (req, res) => {
    const idToken = req.body.id_token;

    // Decode the token to see what's inside
    const decoded = jwt.decode(idToken, { complete: true });

    console.log("Full decoded LTI token:", JSON.stringify(decoded, null, 2));

    const { sub, name, email, roles } = decoded.payload;

    const context =
      decoded.payload["https://purl.imsglobal.org/spec/lti/claim/context"];
    const courseId = context?.id;
    const courseTitle = context?.title;

    console.log("User ID (sub):", sub);
    console.log("Name:", name);
    console.log("Email:", email);
    console.log("Roles:", roles); // e.g. Instructor, Learner
    console.log("Course ID:", courseId);
    console.log("Course Title:", courseTitle);

    // Optionally, pass this to frontend for LTI login page
    res.redirect(
      `https://www.nuubi.app/lti-login?user=${sub}&course=${courseId}&name=${encodeURIComponent(
        name
      )}&email=${encodeURIComponent(email)}&roles=${encodeURIComponent(
        roles.join(",")
      )}`
    );
  }
);

// // 🔹 2. LTI Launch Handler
// router.post("/lti/launch", express.urlencoded({ extended: false }), (req, res) => {
//   const idToken = req.body.id_token;
//   const decoded = jwt.decode(idToken, { complete: true });

//   const { sub, name, email } = decoded.payload;
//   const context =
//     decoded.payload["https://purl.imsglobal.org/spec/lti/claim/context"];

//   // Redirect to Nuubi's frontend for session setup
//   res.redirect(
//     `https://www.nuubi.app/lti-login?user=${sub}&course=${context.id}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`
//   );
// });

// 🔹 3. Session Creator for React Native Web
router.post("/api/lti/session", express.json(), async (req, res) => {
  const { userId, courseId, name, email } = req.body;

  if (!userId || !courseId) {
    return res.status(400).json({ error: "Missing userId or courseId" });
  }

  try {
    // Find or create the user
    let user = await pool.query("SELECT * FROM users WHERE lti_user_id = $1", [
      userId,
    ]);

    if (user.rows.length === 0) {
      const insertResult = await pool.query(
        "INSERT INTO users (lti_user_id, name, email) VALUES ($1, $2, $3) RETURNING *",
        [userId, name || null, email || null]
      );
      user = insertResult;
    }

    // Create JWT or session token
    const token = jwt.sign(
      {
        id: user.rows[0].id,
        lti_user_id: userId,
        course_id: courseId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Send cookie or token
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    return res.json({ success: true, token });
  } catch (err) {
    console.error("LTI session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
