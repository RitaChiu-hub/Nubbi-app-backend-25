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

--- comments below for scratch work
---------- points per user per month/year, without units assigned

SELECT 
    EXTRACT(YEAR FROM p.updated_at) AS year,
    EXTRACT(MONTH FROM p.updated_at) AS month,
    p.recipient_id,
    u.username,
    SUM(p.point_value) AS total_points
FROM 
    points p
JOIN
    users u ON p.recipient_id = u.id
WHERE
    p.group_id = 4
GROUP BY 
    EXTRACT(YEAR FROM p.updated_at),
    EXTRACT(MONTH FROM p.updated_at),
    p.recipient_id,
    u.username
ORDER BY 
    year, month;


--------------------- get units assigned to the points per user

WITH RankedMonths AS (
    SELECT 
        EXTRACT(YEAR FROM p.updated_at) AS year,
        EXTRACT(MONTH FROM p.updated_at) AS month,
        DENSE_RANK() OVER (ORDER BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at)) AS month_rank
    FROM 
        points p
    WHERE
        p.group_id = 4
    GROUP BY 
        EXTRACT(YEAR FROM p.updated_at),
        EXTRACT(MONTH FROM p.updated_at)
),
MonthlyPoints AS (
    SELECT 
        EXTRACT(YEAR FROM p.updated_at) AS year,
        EXTRACT(MONTH FROM p.updated_at) AS month,
        p.recipient_id,
        u.username,
        SUM(p.point_value) AS total_points
    FROM 
        points p
    JOIN
        users u ON p.recipient_id = u.id
    WHERE
        p.group_id = 4
    GROUP BY 
        EXTRACT(YEAR FROM p.updated_at),
        EXTRACT(MONTH FROM p.updated_at),
        p.recipient_id,
        u.username
)
SELECT 
    mp.year,
    mp.month,
    mp.username,
    CASE 
        WHEN rm.month_rank = 1 THEN 'Unit 1'
        ELSE CONCAT('Unit ', rm.month_rank)
    END AS unit_name,
    mp.total_points
FROM 
    MonthlyPoints mp
JOIN
    RankedMonths rm ON mp.year = rm.year AND mp.month = rm.month
ORDER BY 
    mp.year, mp.month;



    ------------------- user infomration and the unit points

    WITH RankedMonths AS (
    SELECT 
        EXTRACT(YEAR FROM p.updated_at) AS year,
        EXTRACT(MONTH FROM p.updated_at) AS month,
        DENSE_RANK() OVER (ORDER BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at)) AS month_rank
    FROM 
        points p
    WHERE
        p.group_id = 4
    GROUP BY 
        EXTRACT(YEAR FROM p.updated_at),
        EXTRACT(MONTH FROM p.updated_at)
),
MonthlyPoints AS (
    SELECT 
        EXTRACT(YEAR FROM p.updated_at) AS year,
        EXTRACT(MONTH FROM p.updated_at) AS month,
        p.recipient_id,
        SUM(p.point_value) AS total_points
    FROM 
        points p
    WHERE
        p.group_id = 4
    GROUP BY 
        EXTRACT(YEAR FROM p.updated_at),
        EXTRACT(MONTH FROM p.updated_at),
        p.recipient_id
),
UserDetails AS (
    SELECT 
        u.id AS user_id,
        u.username,
        u.email
    FROM 
        users u
    JOIN
        participants p ON u.id = p.user_id
    WHERE
        p.group_id = 4
)
SELECT 
    ud.user_id,
    ud.username,
    ud.email,
    MAX(CASE WHEN rm.month_rank = 1 THEN mp.total_points ELSE 0 END) AS Unit_1,
    MAX(CASE WHEN rm.month_rank = 2 THEN mp.total_points ELSE 0 END) AS Unit_2,
    MAX(CASE WHEN rm.month_rank = 3 THEN mp.total_points ELSE 0 END) AS Unit_3,
    MAX(CASE WHEN rm.month_rank = 4 THEN mp.total_points ELSE 0 END) AS Unit_4,
    MAX(CASE WHEN rm.month_rank = 5 THEN mp.total_points ELSE 0 END) AS Unit_5,
    MAX(CASE WHEN rm.month_rank = 6 THEN mp.total_points ELSE 0 END) AS Unit_6,
    MAX(CASE WHEN rm.month_rank = 7 THEN mp.total_points ELSE 0 END) AS Unit_7,
    MAX(CASE WHEN rm.month_rank = 8 THEN mp.total_points ELSE 0 END) AS Unit_8
FROM 
    RankedMonths rm
CROSS JOIN
    UserDetails ud
LEFT JOIN
    MonthlyPoints mp ON mp.year = rm.year AND mp.month = rm.month AND mp.recipient_id = ud.user_id
GROUP BY
    ud.user_id,
    ud.username,
    ud.email
ORDER BY 
    ud.username;
