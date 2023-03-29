const { forgotPasswordSchema } = require("./schema");

const validateForgotPasswordForm = (req, res, next) => {
  const formData = req.body;
  console.log(formData);
  forgotPasswordSchema
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

module.exports = validateForgotPasswordForm;
