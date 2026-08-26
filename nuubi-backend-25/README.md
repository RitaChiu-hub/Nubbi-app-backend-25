# Nuubi Internship – Development Handoff

## Overview

This repository contains the work completed during my Software Developer Internship at Nuubi.

The project is a full-stack social/community application with features including:

- User authentication
- Groups and group management
- Posts
- Comments
- Comment points / interactions
- Image and file attachments
- Push notifications
- User profiles and avatars
- Post and comment editing
- Analytics / activity tracking
- AWS S3 file storage
- Socket.IO real-time communication

This document is intended to help the next developer quickly understand the project, run the application locally, and continue development.

---

# 1. Project Structure

The project is divided into frontend and backend applications.

```text
Nuubi/
├── frontend/
│   ├── components/
│   ├── screens/
│   ├── Chat/
│   ├── assets/
│   ├── styles/
│   ├── config.js
│   └── ...
│
├── backend/
│   ├── routes/
│   ├── models/
│   ├── controllers/
│   ├── socket/
│   ├── middleware/
│   ├── ...
│   └── ...
│
└── README.md

The exact directory structure may vary depending on the branch/version of the repository.

2. Technology Stack
Frontend
React Native
Expo
React Navigation
Formik
Moment.js
Socket.IO Client
Expo Secure Store
Expo Image Picker
React Native Markdown
AWS S3
Backend
Node.js
Express
PostgreSQL
Sequelize
Socket.IO
JWT authentication
AWS S3
Redis
Expo Push Notification Service
3. Prerequisites

Before starting the project, make sure the following are installed:

Node.js
npm
Git
Expo CLI / Expo tooling
PostgreSQL
Redis
AWS credentials/configuration if S3 functionality is required

Check Node.js:

node --version

Check npm:

npm --version
4. Installation

Clone the repository:

git clone <repository-url>
cd <repository-folder>

Install frontend dependencies:

cd frontend
npm install

Install backend dependencies:

cd backend
npm install
5. Environment Variables

The application requires environment variables for backend services and authentication.

Typical configuration includes:

JWT_SECRET=...
DATABASE_URL=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_S3_BUCKET=...

The frontend also requires the backend API URL:

API_URL=...

Do not commit secrets, access keys, JWT secrets, or other credentials to Git.

Use .env.example as a template when available.

6. Running the Backend

Navigate to the backend directory:

cd backend

Install dependencies if necessary:

npm install

Start the backend:

npm start

Depending on the repository configuration, the development command may instead be:

npm run dev

The backend provides:

REST API endpoints
Socket.IO events
Authentication
Database access
S3 upload support
Push notifications
Analytics
7. Running the Frontend

Navigate to the frontend directory:

cd frontend

Install dependencies:

npm install

Start Expo:

npx expo start

For web:

npx expo start --web

The application can then be opened using the Expo development interface.

8. Authentication

The application uses JWT authentication.

The token is retrieved differently depending on the platform.

Mobile:

await SecureStore.getItemAsync("token");

Web:

sessionStorage.getItem("token");

Requests that require authentication should include:

Authorization: `Bearer ${token}`

Socket events may pass the token directly:

socket.emit("event-name", {
  token,
  ...
});

The backend verifies the token using:

jwtVerify(token, process.env.JWT_SECRET)

The decoded user ID is then used to identify the current user.

9. Comment Functionality

Comments are implemented using the post_comments table.

Important fields include:

id
sender_id
post_id
comment_text
image_url
created_at
updated_at

The Sequelize model is defined in the post_comments model.

Example:

comment_text: {
  type: DataTypes.STRING,
  allowNull: false,
},

image_url: {
  type: DataTypes.STRING,
  allowNull: true,
},
10. Comment Images

Comment images were added to support image attachments when creating comments.

The image flow is:

User selects image
        ↓
Frontend obtains S3 presigned URL
        ↓
Image uploaded directly to S3
        ↓
S3 URL stored in post_comments.image_url
        ↓
Comment returned to frontend
        ↓
Image displayed with the comment

The frontend uses Expo Image Picker:

ImagePicker.launchImageLibraryAsync(...)

The backend provides the S3 presigned URL endpoint:

POST /file/s3-presigned-url

The returned S3 URL is stored in:

post_comments.image_url
11. Editing Comments

Comment editing was implemented so that a user can edit their own comments.

The frontend displays the Edit button only for the comment author.

The comment response contains:

sender_id
sender_username
sender_avatar_url
post_comment_id
comment_text
image_url
comment_iso_time_sent
comment_points

The frontend compares the current user's identity with the comment author.

When Edit is selected, the application passes:

setUser({
  ...user,
  comment_id: comments.post_comment_id,
  comment_text: comments.comment_text,
  comment_image: comments.image_url,
});

The user is then navigated to:

EditComment
12. Edit Comment Socket Event

The backend supports:

socket.on("edit comment", ...)

The client sends:

socket.emit("edit comment", {
  token,
  commentId,
  commentText,
  imageUrl,
});

The backend first verifies:

JWT token is valid.
The comment exists.
The current user owns the comment.

The ownership check is performed using:

SELECT sender_id
FROM post_comments
WHERE id = $1

The backend then compares:

existingComment.sender_id !== userID

If the user is not the comment owner, the operation is rejected.

The comment is updated using:

UPDATE post_comments
SET
  comment_text = $1,
  image_url = $2,
  updated_at = NOW()
WHERE id = $3

The updated comment is returned through:

edit comment success

Errors are returned through:

edit comment error
13. Comment Retrieval

Comments are retrieved through:

handleGetPostComments

The query joins:

post_comments
users
points

The returned comment object contains:

sender_username
sender_avatar_url
post_comment_id
sender_id
comment_text
image_url
comment_iso_time_sent
comment_points

The frontend uses these fields to display:

Username
Avatar
Comment text
Comment image
Comment timestamp
Comment points
Edit button
14. Comment Points

Users can interact with comments using the point system.

The frontend sends:

POST /groups/addcommentpoint

with:

{
  comment_id: comments.post_comment_id
}

The displayed comment points are retrieved from the points table.

15. Post Editing

Posts already support editing through:

EditPost

The post edit page supports:

Post title
Post body
Image
File attachment

The current implementation uses the existing post editing flow and navigation structure.

Comment editing was designed to follow the same UI pattern as post editing.

16. Navigation

When adding a new screen, make sure it is registered in every relevant React Navigation stack.

For example:

<StackHome.Screen
  name="EditComment"
  component={EditCommentScreen}
/>

Other stacks that expose EditPost may also need:

<StackSearch.Screen
  name="EditComment"
  component={EditCommentScreen}
/>
<StackHandleInvite.Screen
  name="EditComment"
  component={EditCommentScreen}
  options={{ drawerItemStyle: { display: "none" } }}
/>
<StackMyGroups.Screen
  name="EditComment"
  component={EditCommentScreen}
/>

When adding a screen, search the codebase for:

name="EditPost"

and check whether the same navigator also needs EditComment.

17. Push Notifications

Comment creation also triggers notifications.

When a new comment is created:

The post author is identified.
Previous commenters are identified.
Duplicate recipients are removed.
The current user is excluded.
Notification records are created.
Push notifications are sent when the recipient has a push token.

The push notification service currently uses the Expo Push API.

Notification information includes:

{
  postId: req.currentPost,
  groupId: postGroupId
}
18. Awards

Comment activity can trigger award checks.

The comment flow calls:

checkAwardsForUser(userID, postGroupId)

The post author is also checked:

checkAwardsForUser(postAuthorId, postGroupId)

These calls are asynchronous and errors are logged.

19. Redis Analytics

Comment activity is also recorded for analytics.

Example:

recordActivity({
  userId: userID,
  groupId: postGroupId,
  statDate: new Date().toISOString().split("T")[0],
  increments: {
    comments: 1
  }
})

This allows comment activity to be aggregated by:

User
Group
Date
20. Important Development Notes
Socket.IO

Socket.IO events use:

socket.emit(...)

and:

socket.on(...)

Do not treat socket.emit() like a normal fetch() request.

For example, this is incorrect:

const res = await socket.emit("edit comment", data);

if (!res.ok) {
  ...
}

socket.emit() does not return an HTTP response.

Instead, listen for the server response:

socket.on("edit comment success", ...)

and:

socket.on("edit comment error", ...)
S3 Image URLs

When editing comments, use the comment-specific image field:

user.comment_image

rather than:

user.image_url

This prevents confusion between post images and comment images.

Current User Identity

The comment API returns:

sender_id

This is the user ID of the person who created the comment.

The frontend can use either:

sender_id

or:

sender_username

to determine whether the current user owns the comment, depending on what user information is available in the current screen.

Using the user ID is preferable when available because usernames may change or may not be unique.

21. Troubleshooting
EditComment navigation error

If React Navigation reports:

The action 'NAVIGATE' with payload {"name":"EditComment"}
was not handled by any navigator.

Make sure EditComment is registered in the active navigator.

Search for:

name="EditPost"

and add EditComment to the same navigator when necessary.

socket is not defined

Make sure the socket instance is imported correctly:

import socket from "../../socket";

The exact path depends on the location of the screen.

Do not create a second Socket.IO connection unless there is a specific reason to do so. Reuse the application's existing socket instance.

props is not defined inside Formik

Formik's render function provides:

{(props) => (
  ...
)}

Inside onSubmit, however, the form values are available through:

onSubmit={async (values) => {

Therefore use:

values.comment_text

inside onSubmit, not:

props.values.comment_text
22. Recommended Development Workflow

When implementing a new feature:

Pull the latest code.
Install/update dependencies if required.
Start the backend.
Start the frontend.
Confirm the application launches.
Reproduce the existing behavior.
Identify the frontend component.
Identify the corresponding backend route/socket event.
Check the database model/schema.
Implement the smallest necessary change.
Test the happy path.
Test invalid input and authorization.
Test both web and mobile when applicable.
Check existing functionality for regressions.
Commit changes with a descriptive message.
23. Work Completed During Internship

The following areas were worked on during the internship:

Comment Improvements
Added image support to comments.
Integrated image upload with AWS S3.
Updated comment rendering to display images.
Updated backend comment retrieval to return image URLs.
Implemented comment editing.
Added author verification before editing comments.
Added Edit Comment navigation and screen.
Added support for updating comment text and images.
Frontend
Worked with React Native / Expo screens.
Updated React Navigation stacks.
Updated Formik forms.
Implemented image selection and upload flows.
Updated comment UI and interactions.
Debugged web and mobile-specific behavior.
Backend
Updated Socket.IO events.
Added comment update handling.
Added authorization checks.
Updated PostgreSQL queries.
Integrated S3 presigned URL handling.
Worked with notification and analytics flows.
Infrastructure / Supporting Features
Worked with AWS S3.
Worked with PostgreSQL.
Worked with Redis analytics.
Worked with Expo push notifications.
Worked with Socket.IO real-time communication.
24. Handoff Checklist

Before continuing development, verify:

 Backend starts successfully.
 Frontend starts successfully.
 Database connection works.
 Authentication works.
 Socket.IO connection works.
 Existing posts can be viewed.
 Existing comments can be viewed.
 New comments can be created.
 Comment images can be uploaded.
 Comment images are displayed.
 Comment points work.
 Only the comment author sees the Edit button.
 Comment editing works.
 Comment images can be replaced/removed.
 Unauthorized comment editing is rejected.
 Post editing still works.
 Push notifications still work.
 Redis analytics still records comment activity.
25. Notes for Future Development

When modifying the comment system, keep the following relationships in mind:

User
  │
  └── sender_id
        │
        ▼
Post Comment
  │
  ├── post_id
  ├── comment_text
  ├── image_url
  ├── created_at
  └── updated_at

The frontend comment object is enriched with user information:

post_comment_id
sender_id
sender_username
sender_avatar_url
comment_text
image_url
comment_iso_time_sent
comment_points

When adding new comment functionality, make sure the backend query and frontend expectations remain consistent.

26. Summary

The main goal of the work was to extend the existing Nuubi social/community application while preserving its existing architecture.

The comment system was extended from text-only comments to support:

Create Comment
      ↓
Text + Image
      ↓
S3 Upload
      ↓
PostgreSQL
      ↓
Comment Retrieval
      ↓
Comment Display
      ↓
Author Verification
      ↓
Edit Comment
      ↓
Updated Text + Image

Future developers should reuse the existing authentication, Socket.IO, S3, navigation, and database patterns whenever possible rather than introducing parallel implementations.