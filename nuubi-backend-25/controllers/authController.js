const pool = require("../db");
const bcrypt = require("bcrypt");
const { jwtSign, jwtVerify, getJwt } = require("./jwt/jwtAuth");

module.exports.handleLogin = async (req, res) => {
  console.log("hi");
  const token = getJwt(req);
  console.log("the token from the request is " + token);

  if (!token) {
    res.json({ loggedIn: false });
    return;
  }

  jwtVerify(token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const potentialUser = await pool.query(
        "SELECT username FROM users u WHERE u.username = $1",
        [decoded.username]
      );
      console.log("decoded username is : " + decoded.username);
      console.log("potential user rowcount : " + potentialUser.rowCount);

      if (potentialUser.rowCount === 0) {
        res.json({ loggedIn: false, token: null });
        return;
      }

      res.json({
        loggedIn: true,
        token,
        userId: potentialLogin.rows[0].id,
        username: req.body.username,
      });
    })
    .catch(() => {
      res.json({ loggedIn: false });
      console.log("jwt verify failed");
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
          //username: req.body.username,
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
            // username: req.body.username,
          }); //added this
          console.log("logged in");
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
  const existingEmail = await pool.query(
    "SELECT email from users WHERE email=$1",
    [req.body.email]
  );

  if (existingEmail.rowCount === 0) {
    const existingUser = await pool.query(
      "SELECT username from users WHERE username=$1",
      [req.body.username]
    );

    if (existingUser.rowCount === 0) {
      // register
      const hashedPass = await bcrypt.hash(req.body.password, 10);
      const newUserQuery = await pool.query(
        "INSERT INTO users(email, username, passhash) values($1,$2,$3) RETURNING id, username",
        [req.body.email, req.body.username, hashedPass]
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
            username: req.body.username,
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
    } else {
      res.json({ loggedIn: false, status: "Username taken" });
    }
  } else {
    res.json({ loggedIn: false, status: "Email is already being used" });
  }
};

module.exports.getMessage = async (req, res) => {
  res.json({
    message: "testing! ",
  });
};
