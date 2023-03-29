const { addMessageSchema } = require("./schema");

const validateAddMessage = (req, res, next) => {
  const formData = req.body;
  addMessageSchema
    .validate(formData)
    .catch(() => {
      res.status(422).send();
    })
    .then((valid) => {
      if (valid) {
        console.log("form is good");
        next();
      } else {
        res.status(422).send();
      }
    });
};

module.exports = validateAddMessage;
