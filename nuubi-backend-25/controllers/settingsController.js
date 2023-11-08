const pool = require("../db");
const bcrypt = require("bcrypt");
require("dotenv").config();
const nodemailer = require("nodemailer");
const currentDate = new Date();

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
  const existingUser = await users.findOne({
    attributes: ["username", "passhash"],
    where: {
      username: req.body.username,
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
          user_id: req.body.userId,
        },
      });

      const deletePointsReceivedQuery = await points.destroy({
        where: {
          recipient_id: req.body.userId,
        },
      });

      const updatePointsSentQuery = await points.update(
        { giver_id: null },
        {
          where: {
            giver_id: req.body.userId,
          },
        }
      );

      const updatePostsQuery = await posts.update(
        { sender_id: null },
        {
          where: {
            sender_id: req.body.userId,
          },
        }
      );

      const updateCommentsQuery = await post_comments.update(
        { sender_id: null },
        {
          where: {
            sender_id: req.body.userId,
          },
        }
      );

      const updateMessagesQuery = await messages.update(
        { sender_id: null },
        {
          where: {
            sender_id: req.body.userId,
          },
        }
      );

      const deleteUserQuery = await users.destroy({
        where: {
          username: req.body.username,
        },
      });

      res.json({ loggedIn: false, status: "User successfully deleted" });
    } else {
      res.json({ ...req.body, status: "Wrong password!" });
    }
  } else {
    res.json({ loggedIn: false, status: "User does not exist" });
  }
};

module.exports.handleUpdateAvatar = async (req, res) => {
  const updateAvatarQuery = await pool.query(
    "UPDATE users SET avatar_url=$2 WHERE id=$1",
    [req.body.userId, req.body.imageUrl]
  );
  res.json({
    ...req.body,
    status: "Avatar successfully updated",
  });
};

module.exports.handleDeleteAvatar = async (req, res) => {
  const deleteAvatarQuery = await pool.query(
    "UPDATE users SET avatar_url=NULL WHERE id=$1",
    [req.body.userId]
  );
  res.json({
    ...req.body,
    status: "Avatar successfully deleted",
  });
};

module.exports.handleGetAvatar = async (req, res) => {
  const getAvatarQuery = await pool.query(
    "SELECT avatar_url FROM users WHERE id=$1",
    [req.body.userId]
  );
  res.json({
    ...req.body,
    avatar_url: getAvatarQuery.rows[0],
    status: "Avatar successfully sent",
  });
};

module.exports.handleUpdateUsername = async (req, res) => {
  const existingUser = await users.findOne({
    attributes: ["username", "passhash"],
    where: {
      username: req.body.username,
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
            username: req.body.username,
          },
        }
      );
      res.json({
        ...req.body,
        loggedIn: true,
        username: req.body.newusername,
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
};

module.exports.handleUpdatePassword = async (req, res) => {
  const existingUser = await users.findOne({
    attributes: ["username", "passhash"],
    where: {
      username: req.body.username,
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
          username: req.body.username,
        },
      }
    );

    res.json({
      ...req.body,
      loggedIn: true,
      username: req.body.username,
      status: "password successfully updated",
    });
  } else {
    res.json({ ...req.body, status: "Wrong password!" });
  }
};

module.exports.handleGeneratePasscode = async (req, res) => {
  const existingUser = await pool.query(
    "SELECT username, email from users WHERE email=$1 OR username=$2",
    [req.body.email, req.body.username]
  );

  if (existingUser.rowCount != 0) {
    const userEmail = existingUser.rows[0].email;

    if (req.body.mypasscode != null) {
      // need to send an email to the user

      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
          //  user: 'youremail@address.com',
          //  pass: 'yourpassword'
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
          req.body.mypasscode, // html body
      });

      // console.log("Message sent: %s", info.messageId);

      if (info.messageId != null) {
        res.json({
          ...req.body,
          status: "Passcode sent to email. May need to check spam folder.",
        });
      }
    } else {
      res.json({
        ...req.body,
        status:
          "You need to generate a passcode. We don't have one on file for you yet.",
      });
    }
  } else {
    res.json({
      ...req.body,
      status: "User with this email does not exist.",
    });
  }
};
//   const existingUser = await users.findOne({
//     attributes: ["username", "email"],
//     where: {
//       [Op.or]: [{ email: req.body.email }, { username: req.body.username }],
//     },
//   });

//   if (existingUser) {
//     const userEmail = existingUser.email;

//     if (req.body.mypasscode != null) {
//       // need to send an email to the user

//       let transporter = nodemailer.createTransport({
//         service: "gmail",
//         auth: {
//           user: process.env.EMAIL_USER,
//           pass: process.env.EMAIL_PASS,
//           //  user: 'youremail@address.com',
//           //  pass: 'yourpassword'
//         },
//       });

//       // send mail with defined transport object
//       let info = await transporter.sendMail({
//         from: "Nuubi Support Team " + process.env.EMAIL_USER, // sender address
//         // to: "email@email.com", // list of receivers
//         to: userEmail,
//         subject: "Requested password reset code", // Subject line
//         // text: "Wait where is this text?", // plain text body
//         html:
//           "<b>You requested a password reset! This is your code. If you didn't request a reset, you can safely ignore this message. CODE: </b>" +
//           req.body.mypasscode, // html body
//       });

//       // console.log("Message sent: %s", info.messageId);

//       if (info.messageId != null) {
//         res.json({
//           ...req.body,
//           status: "Passcode sent to email. May need to check spam folder.",
//         });
//       }
//     } else {
//       res.json({
//         ...req.body,
//         status:
//           "You need to generate a passcode. We don't have one on file for you yet.",
//       });
//     }
//   } else {
//     res.json({
//       ...req.body,
//       status: "User with this email does not exist.",
//     });
//   }
// };

module.exports.handleForgotPassword = async (req, res) => {
  const existingUser = await pool.query(
    "SELECT username from users WHERE email=$1",
    [req.body.email]
  );

  if (existingUser.rowCount != 0) {
    if (req.body.passcode == req.body.mypasscode) {
      const hashedPass = await bcrypt.hash(req.body.passattempt1, 10);
      const updatePasswordQuery = await pool.query(
        "UPDATE users SET passhash=$1 WHERE username=$2",
        [hashedPass, existingUser.rows[0].username]
      );

      if (req.body.loggedIn === true) {
        res.json({
          ...req.body,
          status: "password successfully updated",
        });
      } else {
        res.json({
          ...req.body,
          status:
            "password successfully updated. You may now log in with your new password.",
        });
      }
    } else {
      res.json({ ...req.body, status: "Passcode is incorrect." });
    }
  } else {
    res.json({ ...req.body, status: "User with this email does not exist." });
  }
};
//   const existingUser = await users.findOne({
//     attributes: ["username"],
//     where: {
//       email: req.body.email,
//     },
//   });

//   if (existingUser) {
//     if (req.body.passcode == req.body.mypasscode) {
//       const hashedPass = await bcrypt.hash(req.body.passattempt1, 10);
//       const updatePasswordQuery = await users.update(
//         { passhash: hashedPass },
//         {
//           where: {
//             username: existingUser.username,
//           },
//         }
//       );

//       if (req.body.loggedIn === true) {
//         res.json({
//           ...req.body,
//           status: "password successfully updated",
//         });
//       } else {
//         res.json({
//           ...req.body,
//           status:
//             "password successfully updated. You may now log in with your new password.",
//         });
//       }
//     } else {
//       res.json({ ...req.body, status: "Passcode is incorrect." });
//     }
//   } else {
//     res.json({ ...req.body, status: "User with this email does not exist." });
//   }
// };
