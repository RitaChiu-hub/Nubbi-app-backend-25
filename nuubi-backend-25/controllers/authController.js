const pool = require("../db");
const bcrypt = require("bcrypt");
const { jwtSign, jwtVerify, getJwt } = require("./jwt/jwtAuth");

module.exports.handleLogin = async (req, res) => {
  const token = getJwt(req);

  if (!token) {
    res.json({ loggedIn: false });
    return;
  }

  jwtVerify(token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const potentialUser = await pool.query(
        "SELECT username, id FROM users u WHERE u.username = $1",
        [decoded.username]
      );
      if (potentialUser.rowCount === 0) {
        res.json({ loggedIn: false, token: null });
        return;
      } else {
        res.json({
          loggedIn: true,
          token,
          userId: potentialLogin.rows[0].id,
          username: req.body.username,
        });
      }
    })
    .catch(async () => {
      res.json({ loggedIn: false });
    });
};

module.exports.attemptLogin = async (req, res) => {
  const potentialLogin = await pool.query(
    "SELECT id, username, passhash FROM users u WHERE u.username=$1 OR LOWER(u.email)=LOWER($1)",
    [req.body.username]
  );

  if (potentialLogin.rowCount > 0) {
    const isSamePass = await bcrypt.compare(
      req.body.password,
      potentialLogin.rows[0].passhash
    );
    if (isSamePass) {
      jwtSign(
        {
          username: potentialLogin.rows[0].username,
          id: potentialLogin.rows[0].id,
        },
        process.env.JWT_SECRET,
        { expiresIn: "365d" } //can change to "1min" to test logic when token expires
      )
        .then((token) => {
          res.json({
            loggedIn: true,
            token,
            userId: potentialLogin.rows[0].id,
            username: potentialLogin.rows[0].username,
          });
        })
        .catch((err) => {
          console.log(err);
          res.json({
            loggedIn: false,
            status: "Something went wrong, try again later",
          });
        });
    } else {
      res.json({
        loggedIn: false,
        status: "Wrong username, email or password!",
      });
      console.log("wrong password");
    }
  } else {
    console.log("not good");
    res.json({ loggedIn: false, status: "Wrong username, email or password!" });
  }
};

module.exports.attemptRegister = async (req, res) => {
  console.log("hello");
  const existingEmail = await pool.query(
    "SELECT email from users WHERE email=$1",
    [req.body.email]
  );

  if (existingEmail.rowCount === 0) {
    async function generateUsername() {
      var a = ["Original", "Primary", "Inital", "New", "First"];
      var b = ["User", "Student", "Learner", "Name", "BetaTester"];

      var rA = Math.floor(Math.random() * a.length);
      var rB = Math.floor(Math.random() * b.length);
      const usernameAttempt = a[rA] + b[rB];
      console.log("this username attempt is: " + usernameAttempt);

      const existingUser = await pool.query(
        "SELECT username from users WHERE username=$1",
        [usernameAttempt]
      );
      console.log("existing user " + existingUser.rowCount);
      if (existingUser.rowCount === 0) {
        return usernameAttempt;
      } else {
        return generateUsername();
      }
    }

    const newUsername = await generateUsername();
    console.log("my newUsername is: " + newUsername);

    // const existingUser = pool.query(
    //   "SELECT username from users WHERE username=$1",
    //   [userAttempt]
    // );

    // if (existingUser.rowCount !== 0) {
    //   let userAttempt = generateUsername();
    // } else {
    //   const newUsername = userAttempt;
    // }

    const hashedPass = await bcrypt.hash(req.body.password, 10);

    const newUserQuery = await pool.query(
      "INSERT INTO users(email, username, passhash) values($1,$2,$3) RETURNING id, username",
      [req.body.email, newUsername, hashedPass]
    );
    // 3 for prod with digitalocean db, 7 for localhost db
    const joinNuubiGroupQuery = await pool.query(
      "INSERT INTO participants(user_id, group_id, is_admin) values ($1, 3, false) RETURNING id, user_id, group_id",
      [newUserQuery.rows[0].id]
    );
    jwtSign(
      {
        username: req.body.username,
        id: newUserQuery.rows[0].id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    )
      .then((token) => {
        res.json({
          loggedIn: true,
          token,
          userId: newUserQuery.rows[0].id,
          username: newUsername,
        });
        console.log("new user registered");
      })
      .catch((err) => {
        console.log(err);
        res.json({
          loggedIn: false,
          status: "Something went wrong, try again later",
        });
      });
    // } else {
    //   res.json({ loggedIn: false, status: "Username taken" });
    // }
  } else {
    res.json({ loggedIn: false, status: "Email is already being used" });
  }
};

module.exports.getMessage = async (req, res) => {
  res.json({
    message: "testing! ",
  });
};
