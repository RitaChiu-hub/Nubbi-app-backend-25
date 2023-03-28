const express = require("express");
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 4000;
const app = express();
const host = "0.0.0.0";
const myRouter = require("./routers.js");

app.use(bodyParser.json());
app.use(express.json());

app.use("/backend", myRouter);

app.get("/", function (req, res) {
  res.status(200).json({ message: "nothing" });
});

app.get("/helloworld", function (req, res) {
  res.status(200).json({ message: "hello world" });
});

app.listen(PORT, host, function () {
  console.log("listening on port " + PORT);
});
