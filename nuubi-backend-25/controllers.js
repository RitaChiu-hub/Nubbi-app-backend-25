module.exports.getMessage = async (req, res) => {
  res.json({
    message: "meow meow",
  });
};

module.exports.getMessage2 = async (req, res) => {
  res.json({
    message: "blah blah blah",
  });
};
