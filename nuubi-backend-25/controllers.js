module.exports.getMessage = async (req, res) => {
  res.json({
    message: "testing again",
  });
};

module.exports.getMessage2 = async (req, res) => {
  res.json({
    message: "once again",
  });
};
