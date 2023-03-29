const { newPasswordSchema } = require("./schema");

const validateChangePasswordForm = (req, res, next) => {
  const formData = req.body;
  console.log(formData);
  newPasswordSchema
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

module.exports = validateChangePasswordForm;
