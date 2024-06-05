CREATE EXTENSION citext;

CREATE TABLE users(
    id SERIAL PRIMARY KEY UNIQUE,
    email citext NOT NULL UNIQUE,
    username VARCHAR(28) NOT NULL UNIQUE,
    passhash VARCHAR NOT NULL
);

CREATE TABLE groups(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'untitled group',
    description VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE participants(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    group_id INTEGER REFERENCES groups(id),
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE participants DROP CONSTRAINT participants_user_id_fkey;
ALTER TABLE messages DROP CONSTRAINT messages_sender_id_fkey;
ALTER TABLE posts DROP CONSTRAINT posts_sender_id_fkey;
ALTER TABLE post_comments DROP CONSTRAINT post_comments_sender_id_fkey;

ALTER TABLE points DROP CONSTRAINT points_giver_id_fkey;
ALTER TABLE points DROP CONSTRAINT points_recipient_id_fkey;

ALTER TABLE users ALTER COLUMN id TYPE VARCHAR;

ALTER TABLE participants ALTER COLUMN user_id TYPE VARCHAR;

ALTER TABLE participants ADD CONSTRAINT participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE messages ALTER COLUMN sender_id TYPE VARCHAR;
ALTER TABLE posts ALTER COLUMN sender_id TYPE VARCHAR;
ALTER TABLE post_comments ALTER COLUMN sender_id TYPE VARCHAR;
ALTER TABLE points ALTER COLUMN giver_id TYPE VARCHAR;
ALTER TABLE points ALTER COLUMN recipient_id TYPE VARCHAR;

ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id);
ALTER TABLE posts ADD CONSTRAINT posts_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id);
ALTER TABLE post_comments ADD CONSTRAINT post_comments_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id);
ALTER TABLE points ADD CONSTRAINT points_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES users(id);
ALTER TABLE points ADD CONSTRAINT points_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id);

    -- then add all the fkey contrainsts back 

CREATE TABLE messages(
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    group_id INTEGER REFERENCES groups(id),
    text VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


CREATE TABLE posts(
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    group_id INTEGER REFERENCES groups(id),
    title VARCHAR NOT NULL,
    body_text VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE post_comments(
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    post_id INTEGER REFERENCES posts(id),
    comment_text VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_replies(
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(uuid),
    parent_chat_id INTEGER REFERENCES messages(id),
    reply_text VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DROP TABLE chat_replies;

-- ! holding off on chat replies for now. maybe add similar reply structure for post comments

CREATE TABLE points(
    id SERIAL PRIMARY KEY,
    giver_id INTEGER REFERENCES users(id),
    recipient_id INTEGER REFERENCES users(id),
    point_value INTEGER NOT NULL DEFAULT 1,
    messages_id INTEGER REFERENCES messages(id),
    posts_id INTEGER REFERENCES posts(id),
    comment_id INTEGER REFERENCES post_comments(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

alter table groups alter column description type varchar(800);

ALTER TABLE points ADD COLUMN group_id INTEGER REFERENCES groups(id);

ALTER TABLE groups ADD COLUMN invite_passcode VARCHAR;

ALTER TABLE messages
ADD COLUMN image bytea;

ALTER TABLE messages 
ALTER COLUMN image TYPE VARCHAR;

ALTER TABLE posts ADD COLUMN image_url VARCHAR;

ALTER TABLE post_comments ADD COLUMN image_url VARCHAR;

ALTER TABLE users ADD COLUMN uuid VARCHAR;

update users
set uuid = public.gen_random_uuid();

ALTER TABLE users ALTER COLUMN uuid SET NOT NULL;

ALTER TABLE users ALTER COLUMN uuid DROP NOT NULL;

ALTER TABLE users ADD CONSTRAINT unique_uuid UNIQUE (uuid);

ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE users 
    ALTER COLUMN id TYPE VARCHAR;

ALTER TABLE participants 
    ALTER COLUMN user_id TYPE VARCHAR;

ALTER TABLE posts ADD COLUMN file_url VARCHAR;


--------------- new may 2024


CREATE TABLE badges(
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    criteria VARCHAR NOT NULL,
    point_value INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_badges(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    badge_id INTEGER REFERENCES badges(id),
    group_id INTEGER REFERENCES groups(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks(
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    criteria VARCHAR NOT NULL,
    point_value INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_tasks(
    id SERIAL PRIMARY KEY,
      user_id VARCHAR REFERENCES users(id),
    task_id INTEGER REFERENCES tasks(id),
    group_id INTEGER REFERENCES groups(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications(
    id SERIAL PRIMARY KEY,
    message VARCHAR NOT NULL,
    user_id VARCHAR REFERENCES users(id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- Alter the notifications table to set timezone for created_at and updated_at columns
ALTER TABLE notifications
    ALTER COLUMN created_at 
    TYPE TIMESTAMP WITH TIME ZONE
        USING created_at AT TIME ZONE 'UTC'

ALTER TABLE notifications
    ALTER COLUMN updated_at 
    TYPE TIMESTAMP WITH TIME ZONE
        USING updated_at AT TIME ZONE 'UTC'



ALTER TABLE user_tasks
    ADD COLUMN "completed?" BOOLEAN DEFAULT FALSE;


ALTER TABLE tasks
    DROP COLUMN title,
    DROP COLUMN description,
    DROP COLUMN criteria;


ALTER TABLE tasks
    ADD COLUMN action VARCHAR,
    ADD COLUMN amount INTEGER,
    ADD COLUMN item VARCHAR;


ALTER TABLE user_tasks
    RENAME COLUMN "completed?" TO is_completed;