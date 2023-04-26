const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const myRouter = require("./routers.js");
const helmet = require("helmet");
const authRouter = require("./routers/authRouter");
const { Server } = require("socket.io");
const pool = require("./db");
const cors = require("cors");

app.use(bodyParser.json());
app.use(express.json());
app.use(helmet());
app.use("/auth", authRouter);

const server = require("http").createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    // origin: "*",
    credentials: true,
  },
});

app.use(
  cors({
    origin: "http://localhost:3000",
    // origin: "*",
    credentials: true,
  })
);

server.listen(8080, () => {
  console.log("server listening on port 8080");
});
