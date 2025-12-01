const { createGroupSchema } = require("./schema");

const validateCreateGroup = (req, res, next) => {
  const formData = req.body;
  createGroupSchema
    .validate(formData)
    .catch(() => {
      res.status(422).send();
    })
    .then((valid) => {
      if (valid) {
        next();
      } else {
        res.status(422).send();
      }
    });
};

module.exports = validateCreateGroup;
