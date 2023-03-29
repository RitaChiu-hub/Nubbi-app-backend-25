const { formSchema } = require("./schema");

const validateChangeUsernameForm = (req, res, next) => {
  const username = req.body.newusername;
  const password = req.body.passattempt;
  formSchema
    .validate({ username, password })
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

module.exports = validateChangeUsernameForm;
