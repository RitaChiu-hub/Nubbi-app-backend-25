module.exports.getMessage = async (req, res) => {
  res.json({
    message: "meow",
  });
};

module.exports.getMessage2 = async (req, res) => {
  res.json({
    message: "hi",
  });
};
