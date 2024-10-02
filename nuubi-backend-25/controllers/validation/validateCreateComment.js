const { addCommentSchema } = require("./schema");

const validateCreateComment = (req, res, next) => {
  const formData = req.body;
  addCommentSchema
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

module.exports = validateCreateComment;
