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

  /* (optional) inspect token … */
  const nuubiURL = `https://www.nuubi.app/lti-login?token=${encodeURIComponent(
    idToken
  )}`;

  /* 👉 set CSP header, NOT a <meta> tag */
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.instructure.com"
  );

  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

  /* (if you like, also) */
  // res.setHeader("X-Frame-Options", "ALLOW-FROM https://*.instructure.com");

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

// // Support both GET and POST for /lti/login
// router.all("/login", express.urlencoded({ extended: false }), (req, res) => {
//   console.log("\n📥 LTI LOGIN INITIATED");
//   console.log("Headers:", req.headers);
//   console.log("Query Params:", req.query);
//   console.log("Body:", req.body);

//   const params = req.method === "POST" ? req.body : req.query;
//   const { iss, login_hint, target_link_uri, lti_message_hint, client_id } =
//     params;

//   if (!iss || !login_hint || !client_id || !target_link_uri) {
//     return res.status(400).send("Missing required LTI login parameters.");
//   }

//   const fixedIss = "https://stthomas.beta.instructure.com";

//   const redirect =
//     `${fixedIss}/api/lti/authorize_redirect?` +
//     `client_id=${client_id}&` +
//     `login_hint=${login_hint}&` +
//     `lti_message_hint=${lti_message_hint}&` +
//     `redirect_uri=${encodeURIComponent(target_link_uri)}&` +
//     `response_type=id_token&` +
//     `response_mode=form_post&` +
//     `scope=openid&` +
//     `state=state123&` +
//     `nonce=nonce123&` + // 👈 Already here
//     `prompt=none`; // 👈 ADD THIS

//   //   const redirect =
//   //     `${fixedIss}/login?` +
//   //     `client_id=${client_id}&` +
//   //     `login_hint=${login_hint}&` +
//   //     `lti_message_hint=${lti_message_hint}&` +
//   //     `redirect_uri=${encodeURIComponent(target_link_uri)}&` +
//   //     `response_type=id_token&` +
//   //     `response_mode=form_post&` +
//   //     `scope=openid&` +
//   //     `state=state123&` +
//   //     `nonce=nonce123`;

//   console.log("🔁 Redirecting to Canvas /auth/login:", redirect);

//   res.send(`
//       <html>
//         <head><title>Redirecting...</title></head>
//         <body>
//           <script>
//             window.top.location.href = "${redirect}";
//           </script>
//         </body>
//       </html>
//     `);
// });

// router.post("/launch", express.urlencoded({ extended: false }), (req, res) => {
//   console.log("\n🚀 LTI LAUNCH REQUEST RECEIVED");

//   const idToken = req.body.id_token;
//   if (!idToken) {
//     return res.status(400).send("Missing id_token");
//   }

//   const redirectUrl = `https://www.nuubi.app/lti-login?token=${encodeURIComponent(
//     idToken
//   )}`;

//   const html = `
//   <html>
//     <head>
//       <title>Launching Nuubi…</title>
//       <script>
//         window.onload = function () {
//           window.parent.postMessage({
//             type: "LTI_ID_TOKEN",
//             token: "${idToken}"
//           }, "*");
//         };
//       </script>
//     </head>
//     <body>
//       <p style="text-align:center;font-family:sans-serif;margin-top:50px;">Launching Nuubi…</p>
//     </body>
//   </html>
// `;

//   res.status(200).send(html);
// });

// // router.post("/launch", express.urlencoded({ extended: false }), (req, res) => {
// //   console.log("\n🚀 LTI LAUNCH REQUEST RECEIVED");

// //   console.log("Body:", req.body);
// //   console.log("Headers:", req.headers);

// //   const idToken = req.body.id_token;
// //   if (!idToken) {
// //     return res.status(400).send("Missing id_token");
// //   }

// //   const decoded = jwt.decode(idToken, { complete: true });
// //   console.log("Decoded LTI Token:", JSON.stringify(decoded, null, 2));

// //   // Optional: extract user and course info here
// //   const payload = decoded?.payload;
// //   const userId = payload?.sub;
// //   const name = payload?.name;
// //   const email = payload?.email;
// //   const roles = payload?.["https://purl.imsglobal.org/spec/lti/claim/roles"];
// //   const context =
// //     payload?.["https://purl.imsglobal.org/spec/lti/claim/context"];
// //   const courseId = context?.id;
// //   const courseTitle = context?.title;

// //   console.log("🧑‍🎓 User ID:", userId);
// //   console.log("📧 Email:", email);
// //   console.log("🧑‍🏫 Roles:", roles);
// //   console.log("📘 Course ID:", courseId);
// //   console.log("📘 Course Title:", courseTitle);

// //   // Instead of doing a POST form, just do a simple iframe-safe redirect for now
// //   const redirectUrl = `https://www.nuubi.app/lti-login?token=${encodeURIComponent(
// //     idToken
// //   )}`;

// //   const html = `
// //   <html>
// //     <head>
// //       <title>Launching Nuubi...</title>
// //       <meta http-equiv="Content-Security-Policy" content="frame-ancestors 'self' https://*.instructure.com;">
// //       <script>
// //         window.onload = function() {
// //           window.location.href = "https://www.nuubi.app/lti-login?token=${encodeURIComponent(
// //             idToken
// //           )}";
// //         }
// //       </script>
// //     </head>
// //     <body style="background:#f9f9f9;">
// //       <p style="text-align:center;font-family:sans-serif;margin-top:50px;">Launching Nuubi…</p>
// //     </body>
// //   </html>
// // `;
// //   res.status(200).send(html);
// // });

// module.exports = router;

// // 🔹 3. Session Creator for React Native Web
// router.post("/session", express.json(), async (req, res) => {
//   const { userId, courseId, name, email } = req.body;

//   if (!userId || !courseId) {
//     return res.status(400).json({ error: "Missing userId or courseId" });
//   }

//   try {
//     // Find or create the user
//     let user = await pool.query("SELECT * FROM users WHERE lti_user_id = $1", [
//       userId,
//     ]);

//     if (user.rows.length === 0) {
//       const insertResult = await pool.query(
//         "INSERT INTO users (lti_user_id, name, email) VALUES ($1, $2, $3) RETURNING *",
//         [userId, name || null, email || null]
//       );
//       user = insertResult;
//     }

//     // Create JWT or session token
//     const token = jwt.sign(
//       {
//         id: user.rows[0].id,
//         lti_user_id: userId,
//         course_id: courseId,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "1h" }
//     );

//     // Send cookie or token
//     res.cookie("token", token, {
//       httpOnly: true,
//       secure: true,
//       sameSite: "lax",
//     });

//     return res.json({ success: true, token });
//   } catch (err) {
//     console.error("LTI session error:", err);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });

// module.exports = router;
