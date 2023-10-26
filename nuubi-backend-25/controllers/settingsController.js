const pool = require("../db");
const bcrypt = require("bcrypt");
require("dotenv").config();
const nodemailer = require("nodemailer");

module.exports.handleDeleteAccount = async (req, res) => {
  const existingUser = await pool.query(
    "SELECT username, passhash from users WHERE username=$1",
    [req.body.username]
  );
  if (existingUser.rowCount != 0) {
    // account exists and can be deleted
    const isSamePass = await bcrypt.compare(
      req.body.passattempt,
      existingUser.rows[0].passhash
    );
    if (isSamePass) {
      const deleteParticipantsQuery = await pool.query(
        "DELETE FROM participants WHERE user_id = $1",
        [req.body.userId]
      );

      const deletePointsRecievedQuery = await pool.query(
        "DELETE FROM points WHERE recipient_id = $1",
        [req.body.userId]
      );

      const updatePointsSentQuery = await pool.query(
        "UPDATE points SET giver_id=NULL WHERE giver_id = $1",
        [req.body.userId]
      );

      const updatePostsQuery = await pool.query(
        "UPDATE posts SET sender_id=NULL WHERE sender_id = $1",
        [req.body.userId]
      );

      const updateCommentsQuery = await pool.query(
        "UPDATE post_comments SET sender_id=NULL WHERE sender_id = $1",
        [req.body.userId]
      );

      const updateMessagesQuery = await pool.query(
        "UPDATE messages SET sender_id=NULL WHERE sender_id = $1",
        [req.body.userId]
      );

      const deleteUserQuery = await pool.query(
        "DELETE FROM users WHERE username=$1",
        [req.body.username]
      );
      res.json({ loggedIn: false, status: "User successfully deleted" });
    } else {
      res.json({ ...req.body, status: "Wrong password!" });
    }
  } else {
    res.json({ loggedIn: false, status: "User does not exist" });
  }
};

module.exports.handleUpdateAvatar = async (req, res) => {
  console.log(req.body);
  const updateAvatarQuery = await pool.query(
    "UPDATE users SET avatar_url=$2 WHERE id=$1",
    [req.body.userId, req.body.imageUrl]
  );
  res.json({
    ...req.body,
    status: "Avatar successfully updated",
  });
};

module.exports.handleGetAvatar = async (req, res) => {
  console.log("hi");
  // console.log(req.body);
  // const getAvatarQuery = await pool.query(
  //   "SELECT avatar_url FROM users WHERE id=$1",
  //   [req.body.userId]
  // );
  // console.log(getAvatarQuery.rows[0]);
  // res.json({
  //   ...req.body,
  //   avatar_url: getAvatarQuery.rows[0],
  //   status: "Avatar successfully sent",
  // });
};

module.exports.handleUpdateUsername = async (req, res) => {
  const existingUser = await pool.query(
    "SELECT username, passhash from users WHERE username=$1",
    [req.body.username]
  );
  const isSamePass = await bcrypt.compare(
    req.body.passattempt,
    existingUser.rows[0].passhash
  );
  if (isSamePass) {
    // password is correct, now check and see if the desired new username is taken
    const usernameTaken = await pool.query(
      "SELECT username from users WHERE username=$1",
      [req.body.newusername]
    );
    if (usernameTaken.rowCount === 0) {
      //username is not taken & can be used

      const updateUsernameQuery = await pool.query(
        "UPDATE users SET username=$2 WHERE username=$1",
        [req.body.username, req.body.newusername]
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
  const existingUser = await pool.query(
    "SELECT username, passhash from users WHERE username=$1",
    [req.body.username]
  );
  const isSamePass = await bcrypt.compare(
    req.body.password,
    existingUser.rows[0].passhash
  );
  if (isSamePass) {
    const hashedPass = await bcrypt.hash(req.body.passattempt1, 10);
    const updatePasswordQuery = await pool.query(
      "UPDATE users SET passhash=$1 WHERE username=$2",
      [hashedPass, existingUser.rows[0].username]
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
