const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const pool = require("../db");
const { adjectives } = require("../adjectives");
const { nouns } = require("../nouns");
const { v4: uuidv4 } = require("uuid");

const Sequelize = require("sequelize");
var config = {
  define: {
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
};

const sequelize = new Sequelize({
  dialect: "postgres",
  logging: false,
  database: process.env.DATABASE_NAME,
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false, // Disable SSL certificate verification
    },
  },
  config: config,
});

const DataTypes = require("sequelize").DataTypes;

const {
  participants,
  groups,
  messages,
  points,
  post_comments,
  posts,
  users,
  badges,
  user_badges,
  tasks,
  user_tasks,
  notifications,
  awards,
  user_awards,
} = require("../models/init-models")(sequelize, DataTypes);

/* ────────────────────────────── 1. OIDC login ───────────────────────────── */
router.all("/login", express.urlencoded({ extended: false }), (req, res) => {
  const p = req.method === "POST" ? req.body : req.query;
  const { client_id, login_hint, lti_message_hint, target_link_uri } = p;

  // TEMP: log client_id for future use
  // console.log("🔥 LTI login received → client_id:", client_id);

  // TEMP fallback: basic platform guessing
  let iss;
  if (target_link_uri?.includes("ucumberlands.blackboard.com")) {
    iss = "https://ucumberlands.blackboard.com";
  } else if (target_link_uri?.includes("stthomas.instructure.com")) {
    iss = "https://stthomas.instructure.com";
  } else if (target_link_uri?.includes("stthomas.beta.instructure.com")) {
    iss = "https://stthomas.beta.instructure.com";
  } else if (target_link_uri?.includes("canvas.merrimack.edu")) {
    iss = "https://canvas.merrimack.edu";
  } else if (target_link_uri?.includes("merrimack.instructure.com")) {
    iss = "https://merrimack.instructure.com";
  } else if (target_link_uri?.includes("merrimack.beta.instructure.com")) {
    iss = "https://merrimack.beta.instructure.com";
  } else if (target_link_uri?.includes("canvas.northeastern.edu")) {
    iss = "https://canvas.northeastern.edu";
  } else if (target_link_uri?.includes("northeastern.instructure.com")) {
    iss = "https://northeastern.instructure.com";
  } else if (target_link_uri?.includes("northeastern.beta.instructure.com")) {
    iss = "https://northeastern.beta.instructure.com";
  } else {
    iss = "https://stthomas.beta.instructure.com"; // fallback
  }
  // let iss;
  // if (target_link_uri?.includes("ucumberlands.blackboard.com")) {
  //   iss = "https://ucumberlands.blackboard.com";
  // } else if (target_link_uri?.includes("stthomas.instructure.com")) {
  //   iss = "https://stthomas.instructure.com";
  // } else {
  //   iss = "https://stthomas.beta.instructure.com"; // fallback
  // }
  //const iss = "https://stthomas.beta.instructure.com"; // << fixed issuer

  const redirect =
    `${iss}/api/lti/authorize_redirect?` +
    `client_id=${client_id}&` +
    `login_hint=${login_hint}&` +
    `lti_message_hint=${lti_message_hint}&` +
    `redirect_uri=${encodeURIComponent(target_link_uri)}&` +
    `response_type=id_token&response_mode=form_post&scope=openid&` +
    `state=state123&nonce=nonce123&prompt=none`;

  /* *stay in iframe* – we only move the *iframe* to Canvas, not window.top */
  res.send(`
    <html><head><title>Redirecting…</title></head>
    <body onload="location.replace('${redirect}')"></body></html>
  `);
});

/* ────────────────────────────── 2. LTI launch ───────────────────────────── */
router.post("/launch", express.urlencoded({ extended: false }), (req, res) => {
  const idToken = req.body.id_token;
  if (!idToken) return res.status(400).send("Missing id_token");

  /* ───── quick peek (DEBUG ONLY – no signature check) ───── */
  const decoded = jwt.decode(idToken, { complete: true });

  // Fix: assign payload from decoded
  const payload = decoded.payload;

  const roles =
    payload["https://purl.imsglobal.org/spec/lti/claim/roles"] || [];
  const isAdmin = roles.some(
    (role) => role.includes("Instructor") || role === "Administrator"
  );

  /* (optional) inspect token … */
  const nuubiURL = `https://www.nuubi.app/lti-login?token=${encodeURIComponent(
    idToken
  )}`;

  /* send the page that embeds Nuubi inside the Canvas/Blackboard iframe */
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

// POST /lti/session
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

    let user;

    // If user does not exist, create one
    if (userRes.rows.length === 0) {
      //   async function generateUsername() {
      //     var a = adjectives;
      //     var b = nouns;

      //     var rA = Math.floor(Math.random() * a.length);
      //     var rB = Math.floor(Math.random() * b.length);

      //     var adj = a[rA];
      //     var capAdj = adj.charAt(0).toUpperCase() + adj.slice(1);

      //     var noun = b[rB];
      //     var capNoun = noun.charAt(0).toUpperCase() + noun.slice(1);

      //     const usernameAttempt = capAdj + capNoun;
      //     const existingUser = await pool.query(
      //       "SELECT username FROM users WHERE username = $1",
      //       [usernameAttempt]
      //     );
      //     if (existingUser.rows.length === 0) {
      //       return usernameAttempt;
      //     } else {
      //       return generateUsername();
      //     }
      //   }

      async function getUniqueUsername() {
        const firstRaw = (payload.given_name || "").trim();
        const lastRaw = (payload.family_name || "").trim();

        // keep only letters A‑Z / a‑z
        const first = firstRaw.replace(/[^A-Za-z]/g, "");
        const last = lastRaw.replace(/[^A-Za-z]/g, "");

        let base =
          first && last
            ? first[0].toUpperCase() +
              first.slice(1) +
              last[0].toUpperCase() +
              last.slice(1)
            : null;

        if (!base) {
          const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
          const noun = nouns[Math.floor(Math.random() * nouns.length)];
          base =
            adj[0].toUpperCase() +
            adj.slice(1) +
            noun[0].toUpperCase() +
            noun.slice(1);
        }

        // ensure uniqueness
        let candidate = base;
        let n = 1;
        while (
          (
            await pool.query("SELECT 1 FROM users WHERE username=$1", [
              candidate,
            ])
          ).rows.length > 0
        ) {
          candidate = `${base}${n++}`;
        }
        return candidate;
      }

      const newUsername = await getUniqueUsername();

      const userId = uuidv4();

      const insertRes = await pool.query(
        `INSERT INTO users (id, email, username, passhash, created_via_canvas)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, email, newUsername, null, true]
      );
      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];
    }

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

    // group finder or create new one

    const context =
      payload["https://purl.imsglobal.org/spec/lti/claim/context"];
    const courseId = context?.id;
    const courseTitle = context?.title || "Untitled Course";

    const timestamp = new Date().toISOString();

    let groupId;
    let invitePasscode = null;
    let groupName = courseTitle;

    if (courseId) {
      const isPublic = false;
      //   const timestamp = new Date().toISOString();

      const iss = payload.iss;
      const isCanvas =
        iss.includes("instructure.com") || iss.includes("canvas");
      const isBlackboard = iss.includes("blackboard.com");

      const column = isCanvas
        ? "canvas_course_id"
        : isBlackboard
        ? "blackboard_course_id"
        : null;
      if (!column) throw new Error("Unsupported LMS platform");

      // const existingGroup = await pool.query(
      //   // "SELECT id, invite_passcode FROM groups WHERE canvas_course_id = $1",
      //   `SELECT id, invite_passcode FROM groups WHERE ${column} = $1`,
      //   [courseId]
      // );

      let existingGroup;
      if (isCanvas) {
        existingGroup = await pool.query(
          `SELECT id, invite_passcode FROM groups WHERE canvas_course_id = $1`,
          [courseId]
        );
      } else if (isBlackboard) {
        existingGroup = await pool.query(
          `SELECT id, invite_passcode FROM groups WHERE blackboard_course_id = $1`,
          [courseId]
        );
      } else {
        throw new Error("Unsupported LMS platform");
      }

      if (existingGroup.rows.length === 0) {
        invitePasscode = Math.random().toString(10).substring(2, 8);
        //   const newGroupRes = await pool.query(
        //     //  `INSERT INTO groups (canvas_course_id, name, is_public, invite_passcode, created_at, updated_at)
        //     `INSERT INTO groups (${column}, name, is_public, invite_passcode, created_at, updated_at)
        //   VALUES ($1, $2, $3, $4, $5, $6)
        //  RETURNING id, invite_passcode`,
        //     [
        //       courseId,
        //       courseTitle,
        //       isPublic,
        //       invitePasscode,
        //       timestamp,
        //       timestamp,
        //     ]
        //   );
        let newGroupRes;
        if (isCanvas) {
          newGroupRes = await pool.query(
            `INSERT INTO groups (canvas_course_id, name, is_public, invite_passcode, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, invite_passcode`,
            [
              courseId,
              courseTitle,
              isPublic,
              invitePasscode,
              timestamp,
              timestamp,
            ]
          );
        } else if (isBlackboard) {
          newGroupRes = await pool.query(
            `INSERT INTO groups (blackboard_course_id, name, is_public, invite_passcode, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, invite_passcode`,
            [
              courseId,
              courseTitle,
              isPublic,
              invitePasscode,
              timestamp,
              timestamp,
            ]
          );
        }
        groupId = newGroupRes.rows[0].id;
        invitePasscode = newGroupRes.rows[0].invite_passcode; // ✅ redundant but safe
        groupName = courseTitle;
        const currentDate = new Date();

        const seederMessage = await messages.create({
          group_id: groupId,
          sender_id: "205851f3-f034-4316-b278-9c962443a5d5", // Nuubi Helper
          text: "Welcome to your group’s Chat! This is your space for informal, ongoing conversations. Get to know your group members, ask quick questions, and keep the energy alive. Want to kick things off with a subject-related joke?",
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });

        const seededPost = await posts.create({
          sender_id: "205851f3-f034-4316-b278-9c962443a5d5",
          group_id: groupId,
          title: "Welcome to Threads! Click here for more info",
          body_text:
            "This is a Post. Use this space to ask questions, share resources, or offer helpful tips. Posts are perfect for starting deeper conversations that everyone in the group can see and respond to. Try asking about a tricky concept from class or sharing a study strategy that’s working well for you!",
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });

        const seededComment = await post_comments.create({
          sender_id: "205851f3-f034-4316-b278-9c962443a5d5",
          post_id: seededPost.id,
          comment_text:
            "This is a Post Comment. It can be an answer to the question in the Post or any other helpful response. See the plus signs next to Posts and Comments? You can click the + to reward helpful contributions with a point!",
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });
      } else {
        groupId = existingGroup.rows[0].id;
        invitePasscode = existingGroup.rows[0].invite_passcode; // ✅ grab from DB
        groupName = courseTitle;
      }
      // if (courseId) {
      //   const isPublic = false;
      //   const invitePasscode = Math.random().toString(10).substring(2, 8);

      //   const existingGroup = await pool.query(
      //     "SELECT id FROM groups WHERE canvas_course_id = $1",
      //     [courseId]
      //   );

      //   if (existingGroup.rows.length === 0) {
      //     const newGroupRes = await pool.query(
      //       `INSERT INTO groups (canvas_course_id, name, is_public, invite_passcode, created_at, updated_at)
      //    VALUES ($1, $2, $3, $4, $5, $6)
      //    RETURNING id`,
      //       [
      //         courseId,
      //         courseTitle,
      //         isPublic,
      //         invitePasscode,
      //         timestamp,
      //         timestamp,
      //       ]
      //     );
      //     groupId = newGroupRes.rows[0].id;
      //   } else {
      //     groupId = existingGroup.rows[0].id;
      //   }

      // ✅ Now that groupId is set, check if user is a participant
      const alreadyMember = await pool.query(
        `SELECT * FROM participants WHERE user_id = $1 AND group_id = $2`,
        [user.id, groupId]
      );

      if (alreadyMember.rows.length === 0) {
        await pool.query(
          `INSERT INTO participants (user_id, group_id, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
          [user.id, groupId, isAdmin, timestamp, timestamp]
        );
      }
    }
    // Return token for mobile, and metadata
    return res.json({
      success: true,
      token: nuubiToken,
      isAdmin,
      email: user.email,
      groupId,
      groupName,
      invitePasscode,
    });
  } catch (err) {
    console.error("LTI session error:", err);
    return res.status(500).json({ error: "Failed to process LTI session" });
  }
});

module.exports = router;
