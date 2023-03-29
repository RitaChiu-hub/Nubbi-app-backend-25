const express = require("express");
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 4000;
const app = express();
const host = "0.0.0.0";
const myRouter = require("./routers.js");
const helmet = require("helmet");
const authRouter = require("./routers/authRouter");
const settingsRouter = require("./routers/settingsRouter");
const groupRouter = require("./routers/groupRouter");
const groupchatRouter = require("./routers/groupchatRouter");
const { Server } = require("socket.io");
const pool = require("./db");

app.use(bodyParser.json());
app.use(express.json());
app.use(helmet());
app.use("/auth", authRouter);
app.use("/settings", settingsRouter);
app.use("/groups", groupRouter);
app.use("/groupchat", groupchatRouter);

app.use("/backend", myRouter);

app.get("/", function (req, res) {
  res.status(200).json({ message: "nothing" });
});

app.get("/helloworld", function (req, res) {
  res.status(200).json({ message: "hello world" });
});

const server = require("http").createServer(app);
const io = new Server(server, {
  // cors: {
  //   origin: "https://nuubi-demo-2.herokuapp.com",
  //   credentials: true,
  // },
});

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

app.listen(PORT, host, function () {
  console.log("listening on port " + PORT);
});
