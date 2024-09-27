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

// module.exports.handleLogin = async (req, res) => {
//   console.log("handleLogin");
//   // First, check for the token in cookies (for web)
//   let token = req.cookies.token;
//   console.log(
//     "FROM LOGIN PAGE AT BEGINNING what is req cookies token???" +
//       req.cookies.token
//   );
//   console.log("A");
//   // If no token is found in cookies, check the Authorization header (for mobile)
//   if (!token && req.headers.authorization) {
//     token = req.headers.authorization.split(" ")[1]; // Bearer token
//   }
//   console.log("B");
//   if (!token) {
//     console.log("B.2 No TOKEN");
//     res.json({ token: null });
//     return;
//   }
//   console.log("C");
//   jwtVerify(token, process.env.JWT_SECRET)
//     .then(async (decoded) => {
//       console.log("D");
//       const potentialUser = await users.findOne({
//         attributes: ["id"],
//         where: {
//           id: decoded.id,
//         },
//       });
//       console.log("E");
//       if (!potentialUser) {
//         console.log("F");
//         res.json({ token: null });
//         return;
//       } else {
//         console.log("G")("hello from the else statement about to set cookie");
//         // Set a cookie for web-based authentication
//         if (req.headers.cookie) {
//           res.cookie("token", token, {
//             httpOnly: true,
//             // secure: true,
//             secure: false,
//             sameSite: "Strict",
//             maxAge: 24 * 60 * 60 * 1000, // 1 day expiration
//             path: "/",
//           });
//         }

//         console.log("LOGIN req.headers.cookie " + req.headers.cookie);

//         // Respond without sending the token back, just the user info
//         res.json({
//           message: "Login successful",
//           //   userId: potentialUser.id,
//         });
//       }
//     })
//     .catch((err) => {
//       console.error("JWT verification failed:", err);
//       res.json({ token: null });
//     });
// };

module.exports.handleLogin = async (req, res) => {
  console.log("handleLogin");

  // Check for existing JWT token from cookies (web) or SecureStore (mobile)
  let token = req.cookies.token || req.headers.authorization?.split(" ")[1]; // Bearer token

  if (token) {
    // Verify the token and respond accordingly
    try {
      const decoded = await jwtVerify(token, process.env.JWT_SECRET);
      // Respond with user info or status that they are already logged in
      return res.json({
        message: "User already logged in",
        // userId: decoded.id,
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

// module.exports.handleLogin = async (req, res) => {
//   const token = getJwt(req);

//   if (!token) {
//     // res.json({ loggedIn: false });
//     res.json({ token: null });
//     return;
//   }

//   jwtVerify(token, process.env.JWT_SECRET)
//     .then(async (decoded) => {
//       const potentialUser = await users.findOne({
//         attributes: ["id"],
//         // attributes: ["username", "id"],
//         // where: {
//         //   username: decodedUsername,
//         // },
//       });
//       if (!potentialUser) {
//         //  res.json({ loggedIn: false, token: null });
//         res.json({ token: null });
//         return;
//       } else {
//         res.json({
//           // loggedIn: true,
//           token,
//           //  userId: potentialLogin.rows[0].id,
//           //  username: req.body.username,
//         });
//       }
//     })
//     .catch(async () => {
//       //  res.json({ loggedIn: false });
//       res.json({ token: null });
//     });
// };

// module.exports.attemptLogin = async (req, res) => {
//   const potentialLogin = await users.findOne({
//     attributes: ["id", "username", "passhash"],
//     where: {
//       [Op.or]: [
//         {
//           username: req.body.username,
//         },
//         sequelize.where(
//           sequelize.fn("LOWER", sequelize.col("email")),
//           sequelize.fn("LOWER", req.body.username)
//         ),
//       ],
//     },
//   });

//   if (potentialLogin) {
//     const isSamePass = await bcrypt.compare(
//       req.body.password,
//       potentialLogin.passhash
//     );

//     if (isSamePass) {
//       jwtSign(
//         {
//           id: potentialLogin.id,
//         },
//         process.env.JWT_SECRET,
//         { expiresIn: "365d" } // Adjust expiration as needed
//       )
//         .then((token) => {
//           // Set the cookie with the token for web-based authentication
//           res.cookie("token", token, {
//             httpOnly: true,
//             secure: false,
//             //   secure: process.env.NODE_ENV === "production", // Set secure flag only in production (HTTPS)
//             sameSite: "Strict", // To prevent CSRF attacks
//             maxAge: 24 * 60 * 60 * 1000, // 1 day expiration
//             path: "/",
//           });

//           res.json({
//             loggedIn: true,
//             message: "Login successful",
//           });
//         })
//         .catch((err) => {
//           console.log(err);
//           res.json({
//             token: null,
//             status: "Something went wrong, try again later",
//           });
//         });
//     } else {
//       res.json({
//         token: null,
//         status: "Wrong username, email, or password!",
//       });
//       console.log("Wrong password");
//     }
//   } else {
//     console.log("User not found");
//     res.json({ token: null, status: "Wrong username, email, or password!" });
//   }
// };

module.exports.attemptLogin = async (req, res) => {
  console.log("attemptLogin");

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
        secure: false,
        // secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day expiration
        path: "/",
      });

      // Respond with success
      return res.json({
        message: "Login successful",
        //add token or soemthing here? Need to allow login to be read from the views
      });
    } else {
      return res.status(401).json({ message: "Wrong username or password!" });
    }
  } else {
    return res.status(404).json({ message: "User not found!" });
  }
};

// module.exports.attemptLogin = async (req, res) => {
//   const potentialLogin = await users.findOne({
//     attributes: ["id", "username", "passhash"],
//     where: {
//       [Op.or]: [
//         {
//           username: req.body.username,
//         },
//         sequelize.where(
//           sequelize.fn("LOWER", sequelize.col("email")),
//           sequelize.fn("LOWER", req.body.username)
//         ),
//       ],
//     },
//   });

//   if (potentialLogin) {
//     const isSamePass = await bcrypt.compare(
//       req.body.password,
//       potentialLogin.passhash
//     );

//     if (isSamePass) {
//       jwtSign(
//         {
//           // username: potentialLogin.username,
//           id: potentialLogin.id,
//         },
//         process.env.JWT_SECRET,
//         { expiresIn: "365d" } //can change to "1min" to test logic when token expires
//       )
//         .then((token) => {
//           res.json({
//             loggedIn: true,
//             //  token,
//             message: "Login successful",
//             //  userId: potentialLogin.id,
//             //  username: potentialLogin.username,
//           });
//         })
//         .catch((err) => {
//           console.log(err);
//           res.json({
//             //  loggedIn: false,
//             token: null,
//             status: "Something went wrong, try again later",
//           });
//         });
//     } else {
//       res.json({
//         //  loggedIn: false,
//         token: null,
//         status: "Wrong username, email or password!",
//       });
//       console.log("wrong password");
//     }
//   } else {
//     console.log("not good");
//     //  res.json({ loggedIn: false, status: "Wrong username, email or password!" });
//     res.json({ token: null, status: "Wrong username, email or password!" });
//   }
// };

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
        // username: req.body.username,
        id: newUserQuery.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    )
      .then((token) => {
        res.json({
          // loggedIn: true,
          token,
          //   userId: newUserQuery.id,
          username: newUsername,
          firstSignIn: true,
        });
        console.log("new user registered");
      })
      .catch((err) => {
        console.log(err);
        res.json({
          //  loggedIn: false,
          token: null,
          status: "Something went wrong, try again later",
        });
      });
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
