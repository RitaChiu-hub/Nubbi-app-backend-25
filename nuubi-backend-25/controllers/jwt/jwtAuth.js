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
  // Check for token in cookies (for web)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  // Check for token in Authorization header (for mobile)
  if (req.headers.authorization) {
    return req.headers.authorization.split(" ")[1]; // Bearer <token>
  }

  // Return null if no token is found
  return null;
};
// const getJwt = (req) => req.cookies.token; //req.headers["authorization"].split(" ")[1];

// Middleware to verify JWT from cookies
const jwtVerifyMiddleware = async (req, res, next) => {
  try {
    // Extract token from cookies
    const token = getJwt(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    // Verify the token
    const decoded = await jwtVerify(token, process.env.JWT_SECRET);

    // Attach the decoded token to the request object for further processing
    req.auth = decoded;
    req.user = decoded; // Also set req.user for consistency with other code

    // Proceed to the next middleware
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

module.exports = { jwtSign, jwtVerify, getJwt, jwtVerifyMiddleware };
