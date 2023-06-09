CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    email citext NOT NULL UNIQUE,
    username VARCHAR(28) NOT NULL UNIQUE,
    passhash VARCHAR NOT NULL
);

INSERT INTO users(username, passhash) values($1,$2);

CREATE EXTENSION citext;

INSERT INTO users(email, username, passhash) values($1,$2,$3);

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

 SELECT users.username username,
 users.email email,
 participants.is_admin is_admin
 FROM participants
 INNER JOIN users
 ON participants.user_id = users.id
 WHERE participants.group_id = 1;



 SELECT count(point_value) FROM points GROUP BY recipient_id;

 ALTER TABLE points ADD COLUMN group_id INTEGER REFERENCES groups(id);

 




  SELECT user_id, recipient_id, coalesce(count,0)
FROM 
(SELECT DISTINCT participants.user_id
FROM participants 
INNER JOIN points
ON participants.user_id = points.recipient_id
WHERE participants.group_id = 9
) a

LEFT JOIN

(
	SELECT recipient_id, count(point_value) FROM points WHERE group_id = 9 GROUP BY recipient_id
) b
ON a.user_id = b.recipient_id
			
;

SELECT *
FROM 

(
    SELECT users.id user_id, users.username username, users.email email, participants.is_admin is_admin FROM participants INNER JOIN users ON participants.user_id = users.id WHERE participants.group_id = 9
) c

OUTER JOIN

( 
     SELECT user_id, recipient_id, coalesce(count,0)
FROM 
(SELECT DISTINCT participants.user_id
FROM participants 
INNER JOIN points
ON participants.user_id = points.recipient_id
WHERE participants.group_id = 9
) a

LEFT JOIN

(
	SELECT recipient_id, count(point_value) FROM points WHERE group_id = 9 GROUP BY recipient_id
) b
ON a.user_id = b.recipient_id

) d

ON c.user_id = d.user_id;



 ALTER TABLE groups ADD COLUMN invite_passcode VARCHAR;


 SELECT trim(both '"' from to_json(now())::text);





SELECT a.sender_username, 
	a.post_comment_id, 
	a.sender_id, 
	a.comment_text, 
	a.comment_iso_time_sent,
	coalesce(b.count,0) comment_points
	
FROM (

SELECT username sender_username, 
	post_comments.id post_comment_id, 
	sender_id, 
	comment_text, 
	to_json(post_comments.created_at) comment_iso_time_sent  
	
	FROM post_comments 
	INNER JOIN users 
	ON post_comments.sender_id = users.id 
	WHERE post_id = 1 
	ORDER BY post_comments.created_at DESC

) a 

LEFT JOIN 

(
	SELECT COUNT(point_value), comment_id FROM points WHERE group_id = 1 GROUP BY comment_id
) b ON a.post_comment_id = b.comment_id;

SELECT username sender_username, text, messages.id messages_id, to_json(messages.created_at) iso_time_sent FROM messages INNER JOIN users ON messages.sender_id = users.id WHERE messages.group_id = $1 ORDER BY messages.created_at DESC



SELECT a.sender_username, 
	a.text, 
	a.messages_id, 
	a.iso_time_sent, 
	coalesce(b.count,0) message_points
	
FROM (

SELECT username sender_username, 
text, 
messages.id messages_id, 
to_json(messages.created_at) iso_time_sent 
FROM messages 
INNER JOIN users 
ON messages.sender_id = users.id 
WHERE messages.group_id = 1 
ORDER BY messages.created_at DESC


) a 

LEFT JOIN 

(
	SELECT COUNT(point_value), messages_id FROM points WHERE group_id = 1 GROUP BY messages_id
) b ON a.messages_id = b.messages_id;

SELECT a.sender_username, a.text, a.messages_id, a.iso_time_sent, coalesce(b.count,0) message_points FROM (SELECT username sender_username, text, messages.id messages_id, to_json(messages.created_at) iso_time_sent FROM messages INNER JOIN users ON messages.sender_id = users.id WHERE messages.group_id = $1 ORDER BY messages.created_at DESC) a LEFT JOIN (SELECT COUNT(point_value), messages_id FROM points WHERE group_id = $1 GROUP BY messages_id) b ON a.messages_id = b.messages_id;




SELECT c.post_id post_id, sender_id, title, body_text, post_author, to_json(c.created_at) iso_time_sent, 
coalesce(point_total,0) point_total, coalesce(number_comments,0) number_comments
FROM
(SELECT posts.id post_id, sender_id, title, body_text, username post_author,  posts.created_at created_at
 FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = 26) c

FULL OUTER JOIN

(SELECT point_total, number_comments, post_id posts_id, posts_id FROM 
(SELECT SUM(point_value) point_total, posts_id FROM points WHERE group_id = 26 GROUP BY posts_id) a
FULL OUTER JOIN (SELECT count(id) number_comments, post_id from post_comments group by post_id) b 
ON a.posts_id = b.post_id) d ON c.post_id = d.post_id ORDER BY c.created_at ASC;




SELECT point_total, 
a.post_id post_id, 
number_comments FROM 
(SELECT SUM(point_value) point_total, pots_id FROM points WHERE group_id = 26 GROUP BY posts_id) a
FULL OUTER JOIN 
(SELECT count(id) number_comments, post_id from post_comments group by post_id) b 
ON a.posts_id = b.post_id;


SELECT DISTINCT CASE WHEN id> 0 THEN NULL END point_total,
post_id from post_comments;


(SELECT SUM(point_value) point_total, posts_id post_id 
 FROM points WHERE group_id = 26 GROUP BY posts_id)
UNION
(SELECT DISTINCT CASE WHEN id> 0 THEN 0 END point_total,
post_id from post_comments)


SELECT point_total, 
a.post_id post_id, 
number_comments FROM 
((SELECT SUM(point_value) point_total, posts_id post_id 
 FROM points WHERE group_id = 26 GROUP BY posts_id)
UNION
(SELECT DISTINCT CASE WHEN id> 0 THEN 0 END point_total,
post_id from post_comments)) a
FULL OUTER JOIN 
(SELECT count(id) number_comments, post_id from post_comments group by post_id) b 
ON a.post_id = b.post_id;




-- get info, then left join with point total & left join with number of comments, then coalesce the nulls with 0
SELECT posts.id post_id, sender_id, title, body_text, username post_author, 
 posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id
 WHERE group_id = 26;

-- get post_id and point totals
SELECT posts_id post_id, SUM(point_value) point_total FROM points WHERE group_id = 26 GROUP BY posts_id;
  
  -- getting everything from info & point totals

  SELECT * FROM

(SELECT posts.id post_id, sender_id, title, body_text, username post_author, 
 posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id
 WHERE group_id = 26) a
 
 LEFT JOIN 
 
 (SELECT posts_id post_id, SUM(point_value) point_total FROM points WHERE group_id = 26 GROUP BY posts_id) b 
 ON a.post_id = b.post_id
 ;


 -- get comment totals with post_id 

 select post_id, count(id) number_comments from post_comments group by post_id;

 -- now left join everything 

 SELECT * FROM (
  SELECT * FROM

(SELECT posts.id post_id, sender_id, title, body_text, username post_author, 
 posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id
 WHERE group_id = 26) a
 
 LEFT JOIN 
 
 (SELECT posts_id post_id, SUM(point_value) point_total FROM points WHERE group_id = 26 GROUP BY posts_id) b 
 ON a.post_id = b.post_id
 ) c 
 LEFT JOIN (
     select post_id, count(id) number_comments from post_comments group by post_id
 ) d 
 on c.post_id = d.post_id;

-- adding images to messages
 ALTER TABLE messages
ADD COLUMN image bytea;

ALTER TABLE messages 
ALTER COLUMN image TYPE VARCHAR;