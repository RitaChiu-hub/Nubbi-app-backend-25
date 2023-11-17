const pool = require("../db");
const bcrypt = require("bcrypt");
require("dotenv").config();
const nodemailer = require("nodemailer");
const currentDate = new Date();
const { jwtVerify } = require("./jwt/jwtAuth");

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

const { participants, groups, messages, points, post_comments, posts, users } =
  require("../models/init-models")(sequelize, DataTypes);

const { Op } = require("sequelize");

module.exports.handleDeleteAccount = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const existingUser = await users.findOne({
          attributes: ["username", "passhash"],
          where: {
            //  username: req.body.username,
            user_id: userID,
          },
        });

        if (existingUser) {
          // account exists and can be deleted
          const isSamePass = await bcrypt.compare(
            req.body.passattempt,
            existingUser.passhash
          );
          if (isSamePass) {
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

            const deleteUserQuery = await users.destroy({
              where: {
                //  username: req.body.username,
                user_id: userID,
              },
            });

            // res.json({ loggedIn: false, status: "User successfully deleted" });
            res.json({ token: null, status: "User successfully deleted" });
          } else {
            res.json({ ...req.body, status: "Wrong password!" });
          }
        } else {
          //  res.json({ loggedIn: false, status: "User does not exist" });
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const getAvatarQuery = await pool.query(
          "SELECT avatar_url FROM users WHERE id=$1",
          [userID]
        );
        res.json({
          ...req.body,
          avatar_url: getAvatarQuery.rows[0],
          status: "Avatar successfully sent",
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

module.exports.handleUpdateUsername = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const existingUser = await users.findOne({
          attributes: ["username", "passhash"],
          where: {
            // username: req.body.username,
            user_id: userID,
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
                  user_id: userID,
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const existingUser = await users.findOne({
          attributes: ["username", "passhash"],
          where: {
            //username: req.body.username,
            user_id: userID,
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
                user_id: userID,
              },
            }
          );

          res.json({
            ...req.body,
            // loggedIn: true,
            //  username: req.body.username,
            status: "password successfully updated",
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

  if (existingUser.rowCount != 0) {
    const userEmail = existingUser.rows[0].email;

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
      // to: "email@email.com", // list of receivers
      to: userEmail,
      subject: "Requested password reset code", // Subject line
      // text: "Wait where is this text?", // plain text body
      html:
        "<b>You requested a password reset! This is your code. If you didn't request a reset, you can safely ignore this message. CODE: </b>" +
        mypasscode, // html body
    });

    if (info.messageId != null) {
      res.json({
        ...req.body,
        hashedOTP: hashedOTP,
        status: "Passcode sent to email. May need to check spam folder.",
      });
    }
  } else {
    res.json({
      // loggedIn: false,
      token: null,
      status: "User with this email does not exist.",
    });
  }
};

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
          status: "password successfully updated",
        });
      } else {
        res.json({
          //  loggedIn: false,
          token: null,
          status:
            "password successfully updated. You may now log in with your new password.",
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
