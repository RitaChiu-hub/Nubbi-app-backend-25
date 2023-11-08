const pool = require("../db");
const bcrypt = require("bcrypt");
const { jwtSign, jwtVerify, getJwt } = require("./jwt/jwtAuth");
const { adjectives } = require("./adjectives");
const { nouns } = require("./nouns");
const { sequelize, User, Participant, Group } = require("../index");

const { Op } = require("sequelize");

module.exports.handleLogin = async (req, res) => {
  const token = getJwt(req);

  if (!token) {
    res.json({ loggedIn: false });
    return;
  }

  jwtVerify(token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const potentialUser = await User.findOne({
        attributes: ["username", "id"],
        where: {
          username: decodedUsername,
        },
      });
      if (!potentialUser) {
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
  const potentialLogin = await User.findOne({
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
      jwtSign(
        {
          username: potentialLogin.username,
          id: potentialLogin.id,
        },
        process.env.JWT_SECRET,
        { expiresIn: "365d" } //can change to "1min" to test logic when token expires
      )
        .then((token) => {
          res.json({
            loggedIn: true,
            token,
            userId: potentialLogin.id,
            username: potentialLogin.username,
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
  const existingEmail = await User.findOne({
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
      const existingUser = await User.findOne({
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

    const newUserQuery = await User.create({
      email: req.body.email,
      username: newUsername,
      passhash: hashedPass,
    });
    // 3 for prod with digitalocean db, 7 for localhost db
    //adding to the default group
    const joinNuubiGroupQuery = await pool.query(
      "INSERT INTO participants(user_id, group_id, is_admin) values ($1, 3, false) RETURNING id, user_id, group_id",
      [newUserQuery.id]
    );
    jwtSign(
      {
        username: req.body.username,
        id: newUserQuery.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    )
      .then((token) => {
        res.json({
          loggedIn: true,
          token,
          userId: newUserQuery.id,
          username: newUsername,
          firstSignIn: true,
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
