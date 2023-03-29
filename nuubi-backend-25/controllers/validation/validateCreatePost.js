const { createPostSchema } = require("./schema");

const validateCreatePost = (req, res, next) => {
  const formData = req.body;
  createPostSchema
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

module.exports = validateCreatePost;
