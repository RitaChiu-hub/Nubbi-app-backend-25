const { newPasswordSchema } = require("./schema");

const validateChangePasswordForm = (req, res, next) => {
  const formData = req.body;
  newPasswordSchema
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

module.exports = validateChangePasswordForm;
