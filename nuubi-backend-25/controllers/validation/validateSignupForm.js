const { formSignupSchema } = require("./schema");

const validateSignupForm = (req, res, next) => {
  const formData = req.body;
  formSignupSchema
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

module.exports = validateSignupForm;
