require("dotenv").config();
const jwt = require("jsonwebtoken");

const jwtSign = (payload, secret, options) =>
  new Promise((resolve, reject) => {
    jwt.sign(payload, secret, options, (err, token) => {
      if (err) reject(err);
      resolve(token);
    });
  });

const jwtVerify = (token, secret) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) reject(err);
      resolve(decoded);
    });
  });

const getJwt = (req) => {
  console.log("GetJWT inside jwtAuth");
  console.log("req cookies from getJwt " + req.cookies.token);
  // Check for token in cookies (for web)
  if (req.cookies && req.cookies.token) {
    console.log("hello from getjwt cookies section" + req.cookies.token);
    return req.cookies.token;
  }

  // Check for token in Authorization header (for mobile)
  if (req.headers.authorization) {
    console.log(
      "hello from getjwt auth header section" +
        req.headers.authorization.split(" ")[1]
    );
    return req.headers.authorization.split(" ")[1]; // Bearer <token>
  }

  // Return null if no token is found
  return null;
};
// const getJwt = (req) => req.cookies.token; //req.headers["authorization"].split(" ")[1];

// Middleware to verify JWT from cookies
const jwtVerifyMiddleware = async (req, res, next) => {
  console.log("verifying middleware....");
  console.log("req in middleware" + JSON.stringify(req.cookies, null, 2));
  console.log("res in middleware" + JSON.stringify(res.cookies, null, 2));
  try {
    // Extract token from cookies
    const token = getJwt(req);

    console.log("token from cookies is..." + token);

    if (!token) {
      console.log("no token found");
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    // Verify the token
    const decoded = await jwtVerify(token, process.env.JWT_SECRET);

    // Attach the decoded token to the request object for further processing
    req.auth = decoded;

    // Proceed to the next middleware
    next();
  } catch (err) {
    console.log(err);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

module.exports = { jwtSign, jwtVerify, getJwt, jwtVerifyMiddleware };
