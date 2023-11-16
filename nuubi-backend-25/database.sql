CREATE EXTENSION citext;

CREATE TABLE users(
    id SERIAL PRIMARY KEY,
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
    sender_id INTEGER REFERENCES users(id),
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