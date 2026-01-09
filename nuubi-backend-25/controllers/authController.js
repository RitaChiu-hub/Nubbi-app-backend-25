const pool = require("../db");
const bcrypt = require("bcrypt");
const {
  jwtSign,
  jwtVerify,
} = require("./jwt/jwtAuth");
const { adjectives } = require("../adjectives");
const { nouns } = require("../nouns");
const currentDate = new Date();
// const { uuid } = require("uuidv4");
const { v4: uuidv4 } = require("uuid");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const sessionController = require("./sessionController");

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
} = require("../models/init-models")(sequelize, DataTypes);

const { Op } = require("sequelize");

module.exports.handleLogin = async (req, res) => {
  // Check for existing JWT token from cookies (web) or SecureStore (mobile)
  let token = req.cookies.token || req.headers.authorization?.split(" ")[1]; // Bearer token

  if (token) {
    // Verify the token and respond accordingly
    try {
      const decoded = await jwtVerify(token, process.env.JWT_SECRET);
      // Respond with user info or status that they are already logged in

      return res.json({
        message: "User already logged in",
      });
    } catch (err) {
      console.error("Invalid token:", err);
      // Handle invalid token scenario (optional)
    }
  }

  // If no valid token is found, continue to the login attempt
  // This could be a redirect or just a simple response to indicate the user needs to log in
  return res.json({ message: "No valid session, please log in" });
};

module.exports.attemptLogin = async (req, res) => {
  // Perform credential validation (similar to your existing logic)
  const potentialLogin = await users.findOne({
    attributes: ["id", "username", "passhash"],
    where: {
      [Op.or]: [
        {
          username: req.body.username,
        },
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("email")),
          sequelize.fn("LOWER", req.body.username)
        ),
      ],
    },
  });

  if (potentialLogin) {
    const isSamePass = await bcrypt.compare(
      req.body.password,
      potentialLogin.passhash
    );

    if (isSamePass) {
      // Update last_signin timestamp on successful login
      await users.update(
        { last_signin: new Date() },
        { where: { id: potentialLogin.id } }
      );

      const token = await jwtSign(
        { id: potentialLogin.id },
        process.env.JWT_SECRET,
        { expiresIn: "1d" } // Token Experation
      );

      // Set the cookie for web-based authentication
      res.cookie("token", token, {
        httpOnly: true,
        // secure: false,
        secure: true,
        sameSite: "None",
        // sameSite: "None",
        maxAge: 24 * 60 * 60 * 1000, // 1 day expiration
        path: "/",
      });

      // Start session tracking
      let sessionId = null;
      try {
        const session = await sessionController.startSession(potentialLogin.id, req);
        sessionId = session.session_id;
      } catch (sessionError) {
        console.error("Session start error (non-blocking):", sessionError);
        // Don't fail login if session tracking fails
      }

      // Get user data for response
      const userData = await users.findOne({
        attributes: ["id", "username", "email", "avatar_url"],
        where: { id: potentialLogin.id },
      });

      // Return session info with login response
      return res.json({
        successMessage: "Login successful",
        token: token,
        session_id: sessionId,
        id: userData.id,
        username: userData.username,
        email: userData.email,
        avatar_url: userData.avatar_url,
        //add token or soemthing here? Need to allow login to be read from the views
      });
    } else {
      return res.status(401).json({ message: "Wrong username or password!" });
    }
  } else {
    return res.status(404).json({ message: "User not found!" });
  }
};

module.exports.checkWebLogin = async (req, res) => {
  let token = req.cookies.token || req.headers.authorization?.split(" ")[1]; // Bearer token
  if (token) {
    // Verify the token and respond accordingly
    try {
      const decoded = await jwtVerify(token, process.env.JWT_SECRET);

      return res.json({
        isLoggedIn: true,
      });

    } catch (err) {
      if (err.name === "TokenExpiredError") { console.log("Session expired, please log in again")}
      else {console.log(err.name)}
      return res.json({
        isLoggedIn: false,
      });
    }
  }
};

// Logout function to clear the HttpOnly token cookie
module.exports.logout = async (req, res) => {
  // End session before logging out
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (token) {
      const decoded = await jwtVerify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      // End active session
      const activeSession = await sessionController.getActiveSession(userId);
      if (activeSession) {
        await sessionController.endSession(activeSession.session_id);
      }
    }
  } catch (sessionError) {
    console.error("Session end error (non-blocking):", sessionError);
    // Don't fail logout if session tracking fails
  }

  // Clear the HttpOnly cookie by setting it with an empty value and expiry in the past
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
  });
  return res.json({ successMessage: "Logout successful" });
};

module.exports.freebieSignup = async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  try {
    // ✅ 1. Check if customer already exists in Stripe
    const customers = await stripe.customers.list({ email });
    let customer;

    if (customers.data.length > 0) {
      customer = customers.data[0]; // Use existing customer
    } else {
      // ✅ 2. Create a Free Customer in Stripe with Marketing Tag
      customer = await stripe.customers.create({
        email,
        name,
        description: "Freebie Study Guide Customer",
        metadata: { freebie: "Study Guide", marketing_emails: "yes" },
      });
    }

    // ✅ 3. Send Email with Freebie (Using Nodemailer)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Nuubi Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Free Study Guide & AI-Powered Study Plan",
      text: `Hi ${name},\n\nThank you for signing up! Your free study guide is attached.\n\nJoin our community here: https://nuubi.com/community\n\nBest,\nThe Nuubi Team`,
      attachments: [
        {
          filename: "DataSciencePortfolio.pdf",
          path: "./files/DataSciencePortfolio.pdf",
          contentType: "application/pdf",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Success! Check your email for your freebie!",
      stripe_customer_id: customer.id,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports.attemptMobileLogin = async (req, res) => {
  try {
    console.log("📱 Mobile login attempt:", {
      username: req.body.username,
      ip: req.headers["x-forwarded-for"] || req.connection?.remoteAddress || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
    
    // Perform credential validation (similar to your existing logic)
    const potentialLogin = await users.findOne({
      attributes: ["id", "username", "passhash"],
      where: {
        [Op.or]: [
          {
            username: req.body.username,
          },
          sequelize.where(
            sequelize.fn("LOWER", sequelize.col("email")),
            sequelize.fn("LOWER", req.body.username)
          ),
        ],
      },
    });

    if (potentialLogin) {
      const isSamePass = await bcrypt.compare(
        req.body.password,
        potentialLogin.passhash
      );

      if (isSamePass) {
        // Update last_signin timestamp on successful mobile login
        await users.update(
          { last_signin: new Date() },
          { where: { id: potentialLogin.id } }
        );

        const token = await jwtSign(
          { id: potentialLogin.id },
          process.env.JWT_SECRET,
          { expiresIn: "365d" }
        );

        // Start session tracking
        let sessionId = null;
        try {
          console.log("📱 Starting session for mobile login, user:", potentialLogin.id);
          const session = await sessionController.startSession(potentialLogin.id, req);
          sessionId = session.session_id;
          console.log("✅ Mobile session started:", sessionId);
        } catch (sessionError) {
          console.error("❌ Session start error (non-blocking):", sessionError);
          // Don't fail login if session tracking fails
        }

        // Get user data for response
        const userData = await users.findOne({
          attributes: ["id", "username", "email", "avatar_url"],
          where: { id: potentialLogin.id },
        });

        if (!userData) {
          console.error("User data not found after login for user:", potentialLogin.id);
          return res.status(500).json({ message: "Error retrieving user data" });
        }

        // Return session info with login response
        return res.json({
          successMessage: "Login successful",
          token: token,
          session_id: sessionId,
          id: userData.id,
          username: userData.username,
          email: userData.email,
          avatar_url: userData.avatar_url,
        });
      } else {
        return res.status(401).json({ message: "Wrong username or password!" });
      }
    } else {
      return res.status(404).json({ message: "User not found!" });
    }
  } catch (error) {
    console.error("Error in attemptMobileLogin:", error);
    return res.status(500).json({ 
      message: "Internal server error during login",
      error: error.message 
    });
  }
};

module.exports.attemptRegister = async (req, res) => {
  const existingEmail = await users.findOne({
    attributes: ["email"],
    where: {
      email: req.body.email,
    },
  });

  if (!existingEmail) {
    async function generateUsername() {
      var a = adjectives;
      var b = nouns;

      var rA = Math.floor(Math.random() * a.length);
      var rB = Math.floor(Math.random() * b.length);

      var adj = a[rA];
      var capAdj = adj.charAt(0).toUpperCase() + adj.slice(1);

      var noun = b[rB];
      var capNoun = noun.charAt(0).toUpperCase() + noun.slice(1);

      const usernameAttempt = capAdj + capNoun;
      const existingUser = await users.findOne({
        attributes: ["username"],
        where: {
          username: usernameAttempt,
        },
      });
      if (!existingUser) {
        return usernameAttempt;
      } else {
        return generateUsername();
      }
    }

    const newUsername = await generateUsername();

    const hashedPass = await bcrypt.hash(req.body.password, 10);

    const newUserQuery = await users.create({
      id: uuidv4(),
      email: req.body.email,
      username: newUsername,
      passhash: hashedPass,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 3 for prod with digitalocean db, 7 for localhost db
    // adding to the default group
    const joinNuubiGroupQuery = await pool.query(
      "INSERT INTO participants(user_id, group_id, is_admin) values ($1, 3, false) RETURNING id, user_id, group_id",
      [newUserQuery.id]
    );
    jwtSign(
      {
        id: newUserQuery.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    )
      .then(async (token) => {
        res.cookie("token", token, {
          httpOnly: true,
          secure: true,

          // secure: process.env.NODE_ENV === "production",
          // sameSite: "Strict",
          sameSite: "None",
          maxAge: 24 * 60 * 60 * 1000 * 365, // 1 year expiration
          path: "/",
        });

        // Start session tracking for new user registration
        let sessionId = null;
        try {
          const session = await sessionController.startSession(newUserQuery.id, req);
          sessionId = session.session_id;
        } catch (sessionError) {
          console.error("Session start error for registration (non-blocking):", sessionError);
          // Don't fail registration if session tracking fails
        }

        res.json({
          username: newUsername,
          firstSignIn: true,
          token: token,
          session_id: sessionId,
        });
      })
      .catch((err) => {
        res.json({
          token: null,
          status: "Something went wrong, try again later",
        });
      });
  } else {
    //  res.json({ loggedIn: false, status: "Email is already being used" });
    res.json({ token: null, status: "Email is already being used" });
  }
};

module.exports.attemptMobileRegister = async (req, res) => {
  const existingEmail = await users.findOne({
    attributes: ["email"],
    where: {
      email: req.body.email,
    },
  });
  if (!existingEmail) {
    async function generateUsername() {
      var a = adjectives;
      var b = nouns;

      var rA = Math.floor(Math.random() * a.length);
      var rB = Math.floor(Math.random() * b.length);

      var adj = a[rA];
      var capAdj = adj.charAt(0).toUpperCase() + adj.slice(1);

      var noun = b[rB];
      var capNoun = noun.charAt(0).toUpperCase() + noun.slice(1);

      const usernameAttempt = capAdj + capNoun;
      const existingUser = await users.findOne({
        attributes: ["username"],
        where: {
          username: usernameAttempt,
        },
      });
      if (!existingUser) {
        return usernameAttempt;
      } else {
        return generateUsername();
      }
    }

    const newUsername = await generateUsername();

    const hashedPass = await bcrypt.hash(req.body.password, 10);

    const newUserQuery = await users.create({
      id: uuidv4(),
      email: req.body.email,
      username: newUsername,
      passhash: hashedPass,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 3 for prod with digitalocean db, 7 for localhost db
    // adding to the default group
    const joinNuubiGroupQuery = await pool.query(
      "INSERT INTO participants(user_id, group_id, is_admin) values ($1, 3, false) RETURNING id, user_id, group_id",
      [newUserQuery.id]
    );

    const token = await jwtSign(
      { id: newUserQuery.id },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    );

    // Start session tracking for new user registration
    let sessionId = null;
    try {
      const session = await sessionController.startSession(newUserQuery.id, req);
      sessionId = session.session_id;
    } catch (sessionError) {
      console.error("Session start error for mobile registration (non-blocking):", sessionError);
      // Don't fail registration if session tracking fails
    }

    return res.json({
      successMessage: "Signup successful",
      token: token,
      session_id: sessionId,
      username: newUsername,
      firstSignIn: true,
    });

    // .then((token) => {
    //   res.json({
    //     token,
    //     username: newUsername,
    //     firstSignIn: true,
    //   });
    // })

    // .catch((err) => {
    //   res.json({
    //     token: null,
    //     status: "Something went wrong, try again later",
    //   });
    // });
  } else {
    //  res.json({ loggedIn: false, status: "Email is already being used" });
    res.json({ token: null, status: "Email is already being used" });
  }
};

module.exports.checkEmail = async (req, res) => {
  const existingEmail = await users.findOne({
    attributes: ["email"],
    where: {
      email: req.body.email,
    },
  });
  if (!existingEmail) {
    res.json({ token: null });
  } else {
    res.json({ token: null, status: "This email is already in our database." });
  }
};

module.exports.getMessage = async (req, res) => {
  res.json({
    message: "testing! ",
  });
};
