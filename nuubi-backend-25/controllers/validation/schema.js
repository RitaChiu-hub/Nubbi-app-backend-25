const Yup = require("yup");
const YupPassword = require("yup-password");
YupPassword(Yup);

const formSchema = Yup.object({
  username: Yup.string().trim().required("Username or email required"),
  password: Yup.string().required("Password required"),
});

const formSignupSchema = Yup.object({
  email: Yup.string()
    .required("Email cannot be blank")
    .trim()
    .email("Please enter a valid email"),
  password: Yup.string()
    .required("Password required")
    .min(8, "Password must contain at least 8 characters")
    .max(28, "Password can be a maximum of 28 characters")
    .minLowercase(1, "Password must contain at least 1 lower case letter")
    .minUppercase(1, "Password must contain at least 1 upper case letter")
    .minNumbers(1, "Password must contain at least 1 number")
    .minSymbols(1, "Password must contain at least 1 special character"),
  // .matches(
  //   /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,28})/,
  //   "Must Contain 8 to 28 Characters, One Uppercase, One Lowercase, One Number and One Special Character"
  // ),
  password2: Yup.string()
    .required("Password required")
    .oneOf([Yup.ref("password"), null], "Passwords must match"),
});

const newPasswordSchema = Yup.object({
  password: Yup.string().required("Password required"),
  passattempt1: Yup.string()
    .required("Password required")
    .min(8, "Password must contain at least 8 characters")
    .max(28, "Password can be a maximum of 28 characters")
    .minLowercase(1, "Password must contain at least 1 lower case letter")
    .minUppercase(1, "Password must contain at least 1 upper case letter")
    .minNumbers(1, "Password must contain at least 1 number")
    .minSymbols(1, "Password must contain at least 1 special character"),
  passattempt2: Yup.string()
    .required("Password required")
    .oneOf([Yup.ref("passattempt1"), null], "Passwords must match"),
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
    .max(2000, "Message cannot exceed 2000 characters"),
});

const addCommentSchema = Yup.object({
  mycomment: Yup.string()
    .required("Comment is required")
    .min(1, "Comment must be at least 1 character")
    .max(4000, "Comment cannot exceed 4000 characters"),
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
    .max(6000, "body text cannot exceed 6000 characters"),
});

const createWeeklyTakeawayScheduleSchema = Yup.object({
  start_date: Yup.date().required("Start date is required"),

  end_date: Yup.date()
    .required("End date is required")
    .min(
      Yup.ref("start_date"),
      "End date must be on or after start date"
    ),

  day_of_week: Yup.string()
    .required("Day of week is required")
    .oneOf(
      [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      "Invalid day of week"
    ),

    timezone: Yup.string()
    .oneOf(
      [
        "America/Los_Angeles",
        "America/Chicago",
        "America/New_York",
      ],
      "Invalid timezone"
    )
    .default("America/Los_Angeles"),
  
  scheduled_time: Yup.string()
    .required("Scheduled time is required")
    .matches(
      /^([01]\d|2[0-3]):([0-5]\d)$/,
      "Scheduled time must be in HH:mm format"
    ),  

  title: Yup.string()
    .required("Title is required")
    .min(1, "Title must be at least one character")
    .max(80, "Title cannot exceed 80 characters"),

  body_text: Yup.string()
    .required("Body text is required")
    .min(1, "Body text must be at least one character")
    .max(6000, "Body text cannot exceed 6000 characters"),
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
const getTodayForTimezone = (timezone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  const day = parts.find(
    (part) => part.type === "day"
  )?.value;

  return `${year}-${month}-${day}`;
};


const createScheduledPostSchema = Yup.object({
  title: Yup.string()
    .trim()
    .max(80, "Title must be 80 characters or fewer.")
    .required("Title is required."),

  body_text: Yup.string()
    .trim()
    .required("Post content is required."),

    scheduled_date: Yup.string()
    .matches(
      /^\d{4}-\d{2}-\d{2}$/,
      "Scheduled date must use YYYY-MM-DD format."
    )
    .required("Scheduled date is required.")
    .test(
      "is-today-or-future",
      "Scheduled date must be today or in the future.",
      function (value) {
        if (!value) return false;
    
        const timezone =
          this.parent.timezone ||
          "America/Los_Angeles";
    
        const today =
          getTodayForTimezone(timezone);
    
        return value >= today;
      }
    ),

    scheduled_time: Yup.string()
    .matches(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      "Scheduled time must use HH:mm format."
    )
    .required("Scheduled time is required.")
    .test(
      "is-future-time",
      "Scheduled time must be in the future.",
      function (value) {
        const { scheduled_date, timezone } = this.parent;
        if (!value || !scheduled_date || !timezone) return true;
  
        const now = new Date();
        const scheduledDateTime = new Date(
          `${scheduled_date}T${value}:00`
        ).toLocaleString("en-US", { timeZone: timezone });
  
        return new Date(scheduledDateTime) > now;
      }
    ),

  timezone: Yup.string()
    .oneOf(
      [
        "America/Los_Angeles",
        "America/Chicago",
        "America/New_York",
      ],
      "Invalid timezone."
    )
    .required("Timezone is required."),
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
  createWeeklyTakeawayScheduleSchema,
  createScheduledPostSchema,
};
