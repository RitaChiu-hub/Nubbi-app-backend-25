const pool = require("../db");
const bcrypt = require("bcrypt");
const {
  jwtSign,
  jwtVerify,
  getJwt,
  jwtVerifyMiddleware,
} = require("./jwt/jwtAuth");
const { adjectives } = require("./adjectives");
const { nouns } = require("./nouns");
const currentDate = new Date();
// const { uuid } = require("uuidv4");
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
      const token = await jwtSign(
        { id: potentialLogin.id },
        process.env.JWT_SECRET,
        { expiresIn: "365d" }
      );

      // Set the cookie for web-based authentication
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        // sameSite: "None",
        maxAge: 24 * 60 * 60 * 1000 * 365, // 1 year expiration
        path: "/",
      });

      // Respond with success
      return res.json({
        successMessage: "Login successful",
        token: token,
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
      // Respond with user info or status that they are already logged in
      return res.json({
        isLoggedIn: true,
      });
    } catch (err) {
      console.error("Invalid token:", err);
      // Handle invalid token scenario (optional)
      return res.json({
        isLoggedIn: false,
      });
    }
  }

  // If no valid token is found, continue to the login attempt
  // This could be a redirect or just a simple response to indicate the user needs to log in
  return res.json({ message: "No valid session, please log in" });
};

// Logout function to clear the HttpOnly token cookie
module.exports.logout = async (req, res) => {
  // Clear the HttpOnly cookie by setting it with an empty value and expiry in the past
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    // secure: process.env.NODE_ENV === "production",
    // sameSite: "Strict",
    sameSite: "None",
    path: "/",
  });
  return res.json({
    successMessage: "Logout successful",
    // token: token,
    //add token or soemthing here? Need to allow login to be read from the views
  });
};

module.exports.attemptMobileLogin = async (req, res) => {
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
      const token = await jwtSign(
        { id: potentialLogin.id },
        process.env.JWT_SECRET,
        { expiresIn: "365d" }
      );

      // Respond with success
      return res.json({
        successMessage: "Login successful",
        token: token,
      });
    } else {
      return res.status(401).json({ message: "Wrong username or password!" });
    }
  } else {
    return res.status(404).json({ message: "User not found!" });
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
      created_at: currentDate.getTime(),
      updated_at: currentDate.getTime(),
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
      .then((token) => {
        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          // secure: process.env.NODE_ENV === "production",
          // sameSite: "Strict",
          sameSite: "None",
          maxAge: 24 * 60 * 60 * 1000 * 365, // 1 year expiration
          path: "/",
        });

        res.json({
          username: newUsername,
          firstSignIn: true,
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
      created_at: currentDate.getTime(),
      updated_at: currentDate.getTime(),
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

    return res.json({
      successMessage: "Signup successful",
      token: token,
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
