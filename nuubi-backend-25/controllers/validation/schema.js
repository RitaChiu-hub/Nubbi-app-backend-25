const Yup = require("yup");

const formSchema = Yup.object({
  username: Yup.string().required("Username or email required"),
  password: Yup.string().required("Password required"),
});

const formSignupSchema = Yup.object({
  email: Yup.string()
    .required("Valid email required")
    .email("Valid email required"),
  password: Yup.string()
    .required("Password required")
    .min(6, "Password must be at least 6 characters")
    .max(28, "Password too long!"),
  password2: Yup.string()
    .required("Password required")
    .oneOf([Yup.ref("password"), null], "Passwords must match"),
});

const newPasswordSchema = Yup.object({
  password: Yup.string().required("Password required"),
  passattempt1: Yup.string()
    .required("Password required")
    .min(6, "Password too short")
    .max(28, "Password too long!"),
  passattempt2: Yup.string()
    .required("Password required")
    .min(6, "Password too short")
    .max(28, "Password too long!")
    .oneOf([Yup.ref("passattempt1"), null], "Passwords don't match!"),
});

const forgotPasswordSchema = Yup.object({
  passcode: Yup.string().required("Passcode is required"),
  passattempt1: Yup.string()
    .required("Password required")
    .min(6, "Password too short")
    .max(28, "Password too long!"),
  passattempt2: Yup.string()
    .required("Password required")
    .min(6, "Password too short")
    .max(28, "Password too long!")
    .oneOf([Yup.ref("passattempt1"), null], "Passwords don't match!"),
});

const addMessageSchema = Yup.object({
  mymessage: Yup.string()
    .required("Message is required")
    .min(1, "Message must be at least 1 character")
    .max(500, "Message cannot exceed 500 characters"),
});

const addCommentSchema = Yup.object({
  mycomment: Yup.string()
    .required("Comment is required")
    .min(1, "Comment must be at least 1 character")
    .max(1000, "Comment cannot exceed 1000 characters"),
});

const createGroupSchema = Yup.object({
  groupname: Yup.string()
    .required("Name is required")
    .min(1, "name must be at least one character")
    .max(35, "name cannot exceed 35 characters"),
  description: Yup.string()
    .required("Description is required")
    .min(1, "description must be at least 1 character")
    .max(400, "description cannot exceed 400 characters"),
});

const createPostSchema = Yup.object({
  title: Yup.string()
    .required("Title is required")
    .min(1, "title must be at least one character")
    .max(80, "title cannot exceed 80 characters"),
  body_text: Yup.string()
    .required("Body text is required")
    .min(1, "body text must be at least 1 character")
    .max(4000, "body text cannot exceed 4000 characters"),
});

const changeUsernameSchema = Yup.object({
  username: Yup.string()
    .required("Username required")
    .min(3, "Username must be at least 3 characters")
    .max(28, "Username can be maximum 28 characters")
    .matches(
      /^[a-zA-Z0-9]+$/,
      "Username cannot contain white space or special characters"
    ),
  password: Yup.string().required("Password required"),
});

module.exports = {
  formSchema,
  newPasswordSchema,
  formSignupSchema,
  forgotPasswordSchema,
  addMessageSchema,
  createGroupSchema,
  createPostSchema,
  addCommentSchema,
  changeUsernameSchema,
};
