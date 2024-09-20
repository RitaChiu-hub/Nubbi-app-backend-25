const { jwtVerify, getJwt } = require("./jwtAuth"); // Import your helper functions

module.exports.jwtVerifyMiddleware = async (req, res, next) => {
  try {
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);
    console.log("Request cookies:", req.cookies);
    // console.log("my request is...", JSON.stringify(req, null, 2));
    //     const token = getJwt(req); // Extract token from Authorization header

    //     if (!token) {
    //       return res.status(401).json({ message: "No token provided" });
    //     }

    //     // Verify and decode the token
    //     const decoded = await jwtVerify(token, process.env.JWT_SECRET);
    //     req.auth = decoded; // Add decoded info to req.auth

    //     console.log("HELLO_____________________");
    //     console.log(decoded);

    //     next(); // Proceed to the next middleware
  } catch (error) {
    console.error("JWT verification failed:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};
