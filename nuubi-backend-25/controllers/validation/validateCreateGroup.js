const { createGroupSchema } = require("./schema");

const validateCreateGroup = (req, res, next) => {
  const formData = req.body;
  //const groupname = req.body.groupname;
  //const description = req.body.description;
  createGroupSchema
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

module.exports = validateCreateGroup;
