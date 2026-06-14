require("dotenv").config();
const jwt = require("jsonwebtoken");

const jwtSign = (payload, secret, options) =>
  new Promise((resolve, reject) => {
    jwt.sign(payload, secret, options, (err, token) => {
      if (err) return reject(err);
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
  return null;
};

// Middleware to verify JWT from cookies or headers
const jwtVerifyMiddleware = async (req, res, next) => {
  try {
    const token = getJwt(req);
    if (!token) {
      console.warn("[jwtVerifyMiddleware] No token found in request");
      return res.status(401).json({ error: "No token provided" });
    }
    const decoded = await jwtVerify(token, process.env.JWT_SECRET);

    // add decoded user to request
    req.auth = decoded;
    req.user = decoded; // Also set req.user for consistency with other code

    next();
  } catch (err) {
    console.error("[jwtVerifyMiddleware] Error:", err.message);
    if (err.name === "TokenExpiredError") { 
      return res.status(401).json({ status: "expired", message: "Session expired, please log in again" }); } 
      
    return res.status(401).json({ error: "Invalid token" }); }
};

module.exports = { jwtSign, jwtVerify, getJwt, jwtVerifyMiddleware };
