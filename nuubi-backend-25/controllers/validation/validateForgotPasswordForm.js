const { forgotPasswordSchema } = require("./schema");

const validateForgotPasswordForm = (req, res, next) => {
  const formData = req.body;
  forgotPasswordSchema
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

module.exports = validateForgotPasswordForm;
