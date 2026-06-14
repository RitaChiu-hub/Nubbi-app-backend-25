const pool = require("../db");
const bcrypt = require("bcrypt");
require("dotenv").config();
const nodemailer = require("nodemailer");

const mjml = require("mjml");
const fs = require("fs");
const path = require("path");

const currentDate = new Date();
const { jwtVerify, getJwt } = require("./jwt/jwtAuth");

const { sequelize, DataTypes } = require("../config/database");

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

module.exports.handleDeleteAccount = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    //  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const existingUser = await users.findOne({
          attributes: ["username", "passhash"],
          where: {
            //  username: req.body.username,
            id: userID,
          },
        });

        if (existingUser) {
          // account exists and can be deleted
          const isSamePass = await bcrypt.compare(
            req.body.passattempt,
            existingUser.passhash
          );
          if (isSamePass) {
            const updateAdminQuery = await groups.update(
              { admin_id: null },
              {
                where: {
                  admin_id: userID,
                },
              }
            );
            const deleteParticipantsQuery = await participants.destroy({
              where: {
                user_id: userID,
              },
            });

            const deletePointsReceivedQuery = await points.destroy({
              where: {
                recipient_id: userID,
              },
            });

            const updatePointsSentQuery = await points.update(
              { giver_id: null },
              {
                where: {
                  giver_id: userID,
                },
              }
            );

            const updateUserTasksQuery = await user_tasks.update(
              { user_id: null },
              {
                where: {
                  user_id: userID,
                },
              }
            );
            const updatePostsQuery = await posts.update(
              { sender_id: null },
              {
                where: {
                  sender_id: userID,
                },
              }
            );

            const updateCommentsQuery = await post_comments.update(
              { sender_id: null },
              {
                where: {
                  sender_id: userID,
                },
              }
            );

            const updateMessagesQuery = await messages.update(
              { sender_id: null },
              {
                where: {
                  sender_id: userID,
                },
              }
            );

            const updateNotificationsQuery = await notifications.update(
              { user_id: null },
              {
                where: {
                  user_id: userID,
                },
              }
            );

            const updateBadgesQuery = await user_badges.update(
              { user_id: null },
              {
                where: {
                  user_id: userID,
                },
              }
            );

            const deleteUserQuery = await users.destroy({
              where: {
                id: userID,
              },
            });

            res.clearCookie("token", {
              httpOnly: true,
              secure: true,
              // secure: process.env.NODE_ENV === "production",
              // sameSite: "Strict",
              sameSite: "None",
              path: "/",
            });

            res.json({ token: null, status: "Success" });
          } else {
            res.json({
              ...req.body,
              status:
                "Wrong password! If you signed up via Canvas, you may need to set a Nuubi password in the settings page to verify your access before deleting.",
            });
          }
        } else {
          res.json({ token: null, status: "User does not exist" });
        }
      } catch (error) {
        console.error("Error deleting account: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleUpdateAvatar = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const updateAvatarQuery = await pool.query(
          "UPDATE users SET avatar_url=$2 WHERE id=$1",
          [userID, req.body.imageUrl]
        );
        res.json({
          ...req.body,
          status: "Avatar successfully updated",
        });
      } catch (error) {
        console.error("Error updating avatar: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.savePushToken = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const updatePushTokenQuery = await pool.query(
          "UPDATE users SET push_notification_token=$2 WHERE id=$1",
          [userID, req.body.pushToken]
        );
        res.json({
          ...req.body,
          status: "Push token successfully updated",
        });
      } catch (error) {
        console.error("Error updating push token: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch((err) => {
      console.error("JWT verification failed: ", err);
      res.status(401).json({ error: "Unauthorized" });
    });
};

// GET whether push notifications are enabled
module.exports.getNotifPrefs = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const result = await pool.query(
          "SELECT push_notifications_enabled FROM users WHERE id=$1",
          [userID]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json({
          enabled: result.rows[0].push_notifications_enabled,
        });
      } catch (error) {
        console.error("Error fetching notif prefs: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch((err) => {
      console.error("JWT verification failed: ", err);
      res.status(401).json({ error: "Unauthorized" });
    });
};

// SAVE push notifications enabled/disabled
module.exports.saveNotifPrefs = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        await pool.query(
          "UPDATE users SET push_notifications_enabled=$2 WHERE id=$1",
          [userID, req.body.enabled]
        );

        res.json({
          status: "Push notification preference updated",
          enabled: req.body.enabled,
        });
      } catch (error) {
        console.error("Error updating notif prefs: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch((err) => {
      console.error("JWT verification failed: ", err);
      res.status(401).json({ error: "Unauthorized" });
    });
};

module.exports.handleDeleteAvatar = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const deleteAvatarQuery = await pool.query(
          "UPDATE users SET avatar_url=NULL WHERE id=$1",
          [userID]
        );
        res.json({
          ...req.body,
          status: "Avatar successfully deleted",
        });
      } catch (error) {
        console.error("Error deleting avatar: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleGetAvatar = async (req, res) => {
  // Check for existing JWT token from cookies (web) or Authorization header (mobile)
  let token = req.cookies.token || req.headers.authorization?.split(" ")[1]; // Bearer token
  if (token) {
    try {
      // Verify the token
      const decoded = await jwtVerify(token, process.env.JWT_SECRET);
      const userID = decoded.id;
      try {
        // Query the database to get the avatar URL
        const getAvatarQuery = await pool.query(
          "SELECT avatar_url FROM users WHERE id=$1",
          [userID]
        );

        // Return the avatar URL
        res.json({
          avatar_url: getAvatarQuery.rows[0]?.avatar_url || null,
          status: "Avatar successfully sent",
        });
      } catch (error) {
        console.error("Error fetching avatar: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    } catch (err) {
      console.error("Invalid token:", err);
      res.status(401).json({ error: "Invalid or expired token" });
    }
  } else {
    res.status(401).json({ error: "No token provided" });
  }
};

module.exports.handleUpdateUsername = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    //  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const existingUser = await users.findOne({
          attributes: ["username", "passhash"],
          where: {
            // username: req.body.username,
            id: userID,
          },
        });
        const isSamePass = await bcrypt.compare(
          req.body.passattempt,
          existingUser.passhash
        );
        if (isSamePass) {
          // password is correct, now check and see if the desired new username is taken
          const usernameTaken = await users.findOne({
            attributes: ["username"],
            where: {
              username: req.body.newusername,
            },
          });
          if (!usernameTaken) {
            //username is not taken & can be used

            const updateUsernameQuery = await users.update(
              { username: req.body.newusername },
              {
                where: {
                  // username: req.body.username,
                  id: userID,
                },
              }
            );
            res.json({
              ...req.body,
              // loggedIn: true,
              // username: req.body.newusername,
              status: "Username successfully updated",
            });
          } else {
            res.json({
              ...req.body,
              status: "Username is already taken!",
            });
          }
        } else {
          res.json({ ...req.body, status: "Wrong password!" });
        }
      } catch (error) {
        console.error("Error updating username: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleUpdatePassword = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    //  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const existingUser = await users.findOne({
          attributes: ["username", "passhash"],
          where: {
            //username: req.body.username,
            id: userID,
          },
        });

        const isSamePass = await bcrypt.compare(
          req.body.password,
          existingUser.passhash
        );
        if (isSamePass) {
          const hashedPass = await bcrypt.hash(req.body.passattempt1, 10);
          const updatePasswordQuery = await users.update(
            { passhash: hashedPass },
            {
              where: {
                //  username: req.body.username,
                id: userID,
              },
            }
          );

          res.json({
            ...req.body,
            // loggedIn: true,
            //  username: req.body.username,
            status: "Password successfully updated",
          });
        } else {
          res.json({ ...req.body, status: "Wrong password!" });
        }
      } catch (error) {
        console.error("Error updating password: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleGeneratePasscode = async (req, res) => {
  const myNumber = Math.random().toString(10).substring(2, 8);
  const mypasscode = myNumber;
  const hashedOTP = await bcrypt.hash(mypasscode, 10);

  const existingUser = await pool.query(
    "SELECT username, email from users WHERE email=$1 OR username=$2",
    [req.body.email, req.body.username]
  );

  const userEmail = req.body.email;
  //const userName = existingUser.rows[0].username;

  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Construct the correct path to the image file
  const imagePath = path.join(__dirname, "..", "assets", "Logo_Tagline.png");
  const imageContent = fs.readFileSync(imagePath, { encoding: "base64" });

  // Read and compile MJML template
  const mjmlTemplatePath = path.join(
    __dirname,
    "..",
    "templates",
    "resetPasswordEmail.mjml"
  );
  const mjmlTemplate = fs.readFileSync(mjmlTemplatePath, "utf-8");

  // Replace the placeholders with actual values
  const compiledHtml = mjml(
    mjmlTemplate.replace("{{ mypasscode }}", mypasscode),
    { filePath: mjmlTemplatePath }
  );

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: "Nuubi Support Team " + process.env.EMAIL_USER, // sender address
    to: userEmail,
    subject: "Reset Password on Nuubi", // Subject line
    html: compiledHtml.html, // Use the compiled HTML
    attachments: [
      {
        filename: "Logo_Tagline.png",
        content: imageContent,
        encoding: "base64",
        cid: "image1", // Content-ID for referencing the image in the HTML
      },
    ],
  });
  // if (existingUser.rowCount != 0) {
  //   const userEmail = existingUser.rows[0].email;

  //   let transporter = nodemailer.createTransport({
  //     service: "gmail",
  //     auth: {
  //       user: process.env.EMAIL_USER,
  //       pass: process.env.EMAIL_PASS,
  //     },
  //   });

  //   // send mail with defined transport object
  //   let info = await transporter.sendMail({
  //     from: "Nuubi Support Team " + process.env.EMAIL_USER, // sender address
  //     // to: "email@email.com", // list of receivers
  //     to: userEmail,
  //     subject: "Requested password reset code", // Subject line
  //     // text: "Wait where is this text?", // plain text body
  //     html:
  //       "<b>You requested a password reset! This is your code. If you didn't request a reset, you can safely ignore this message. CODE: </b>" +
  //       mypasscode, // html body
  //   });

  if (info.messageId != null) {
    res.json({
      ...req.body,
      hashedOTP: hashedOTP,
      status:
        "Passcode sent to email. May take up to 5 min. Check spam/junk. If not after 10, retry and check for typos.",
      //  status: "Passcode sent to email. May need to check spam folder.",
    });
    //  }
  } else {
    res.json({
      // loggedIn: false,
      token: null,
      status: "User with this email does not exist.",
    });
  }
};

module.exports.handleSendFeedback = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    //  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const getUserEmail = await pool.query(
          "SELECT email FROM users WHERE id = $1;",
          [userID]
        );

        const userEmail = getUserEmail.rows[0].email;

        let transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        // send mail with defined transport object
        let info = await transporter.sendMail({
          from: "Nuubi Support Team " + process.env.EMAIL_USER, // sender address
          to: process.env.EMAIL_USER, // send to Kat
          subject: "User Feedback", // Subject line
          // text: "Wait where is this text?", // plain text body
          html:
            "<p>A user sent feedback! Here's what they have to say: </p>" +
            req.body.userFeedback +
            "<p> The user's email is: </p>" +
            userEmail, // html body
        });

        res.json({ ...req.body, status: "Email successfully sent" });
      } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleGenerateSignUpCode = async (req, res) => {
  const myNumber = Math.random().toString(10).substring(2, 8);
  const mypasscode = myNumber;
  const hashedOTP = await bcrypt.hash(mypasscode, 10);

  const userEmail = req.body.email;

  const existingUser = await pool.query(
    "SELECT username from users WHERE email=$1",
    [req.body.email]
  );

  // const userName = existingUser.rows[0].username;

  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Construct the correct path to the image file
  const imagePath = path.join(__dirname, "..", "assets", "Logo_Tagline.png");
  const imageContent = fs.readFileSync(imagePath, { encoding: "base64" });

  // Read and compile MJML template
  const mjmlTemplatePath = path.join(
    __dirname,
    "..",
    "templates",
    "codeVerificationEmail.mjml"
  );
  const mjmlTemplate = fs.readFileSync(mjmlTemplatePath, "utf-8");

  // Replace the placeholders with actual values
  const compiledHtml = mjml(
    mjmlTemplate.replace("{{ mypasscode }}", mypasscode),
    { filePath: mjmlTemplatePath }
  );

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: "Nuubi Support Team " + process.env.EMAIL_USER, // sender address
    to: userEmail,
    subject: "Security Verification Code", // Subject line
    html: compiledHtml.html, // Use the compiled HTML
    attachments: [
      {
        filename: "Logo_Tagline.png",
        content: imageContent,
        encoding: "base64",
        cid: "image1", // Content-ID for referencing the image in the HTML
      },
    ],
  });

  if (info.messageId != null) {
    res.json({
      ...req.body,
      hashedOTP: hashedOTP,
      status:
        "Passcode sent to email. May take up to 5 min. Check spam/junk. If not after 10, retry and check for typos.",
      //status: "Passcode sent to email. May need to check spam folder.",
    });
  }
};

module.exports.handleValidateSignUp = async (req, res) => {
  // Compare the user's input with the hashedOTP
  const isSameOTP = await bcrypt.compare(
    req.body.userInputCode,
    req.body.hashedOTP
  );
  // If they are validated to be the same, reply with an appropriate message.
  if (isSameOTP) {
    res.status(200).json({
      ...req.body,
      status: "OTP is valid!",
    });
  } else {
    res.status(401).json({ ...req.body, status: "OTP Passcode is incorrect." });
  }
};

// module.exports.handleGenerateSignUpCode = async (req, res) => {
//   const myNumber = Math.random().toString(10).substring(2, 8);
//   const mypasscode = myNumber;
//   const hashedOTP = await bcrypt.hash(mypasscode, 10);

//   const userEmail = req.body.email;

//   let transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   // send mail with defined transport object
//   let info = await transporter.sendMail({
//     from: "Nuubi Support Team " + process.env.EMAIL_USER, // sender address
//     // to: "email@email.com", // list of receivers
//     to: userEmail,
//     subject: "Sign up verification code", // Subject line
//     // text: "Wait where is this text?", // plain text body
//     html:
//       "<b>You attempted to create a new account! This is your code. If you didn't request a reset, you can safely ignore this message. CODE: </b>" +
//       mypasscode, // html body
//   });

//   if (info.messageId != null) {
//     res.json({
//       ...req.body,
//       hashedOTP: hashedOTP,
//       status: "Passcode sent to email. May need to check spam folder.",
//     });
//   }
// };

// module.exports.handleValidateSignUp = async (req, res) => {
//   // Compare the user's input with the hashedOTP
//   const isSameOTP = await bcrypt.compare(
//     req.body.userInputCode,
//     req.body.hashedOTP
//   );

//   // If they are validated to be the same, reply with an appropriate message.
//   if (isSameOTP) {
//     if (req.body.token !== null && req.body.token !== "undefined") {
//       res.status(200).json({
//         ...req.body,
//         status: "OTP is valid!",
//       });
//     } else {
//       res.status(200).json({
//         token: null,
//         status: "OTP is valid!",
//       });
//     }
//   } else {
//     res.status(401).json({ ...req.body, status: "OTP Passcode is incorrect." });
//   }
// };

module.exports.handleForgotPassword = async (req, res) => {
  const existingUser = await pool.query(
    "SELECT username from users WHERE email=$1",
    [req.body.email]
  );

  if (existingUser.rowCount != 0) {
    const isSameOTP = await bcrypt.compare(
      req.body.passcode,
      req.body.hashedOTP
    );

    //  if (req.body.passcode == req.body.mypasscode) {
    if (isSameOTP) {
      const hashedPass = await bcrypt.hash(req.body.passattempt1, 10);
      const updatePasswordQuery = await pool.query(
        "UPDATE users SET passhash=$1 WHERE username=$2",
        [hashedPass, existingUser.rows[0].username]
      );

      // if (req.body.loggedIn === true) {
      if (req.body.token !== null && req.body.token !== "undefined") {
        res.json({
          ...req.body,
          status: "Password successfully updated",
        });
      } else {
        res.json({
          //  loggedIn: false,
          token: null,
          status:
            "Password successfully updated. You may now log in with your new password.",
        });
      }
    } else {
      res.json({ ...req.body, status: "Passcode is incorrect." });
    }
  } else {
    res.json({
      //  loggedIn: false,
      token: null,
      status: "User with this email does not exist.",
    });
  }
};
