module.exports.getMessage = async (req, res) => {
  console.log("hi from backend");
  res.json({
    message: "hyo",
  });
};

module.exports.getMessage2 = async (req, res) => {
  res.json({
    message: "hi",
  });
};
