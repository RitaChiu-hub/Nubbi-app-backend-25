-- Clean Database Schema for Nuubi Local Development
-- This creates all tables in the correct order

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users(
    id VARCHAR PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username VARCHAR(28) NOT NULL UNIQUE,
    passhash VARCHAR,
    avatar_url VARCHAR,
    push_notification_token VARCHAR(255),
    created_via_canvas BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'untitled group',
    description VARCHAR(800),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    invite_passcode VARCHAR,
    canvas_course_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Participants table
CREATE TABLE participants(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    group_id INTEGER REFERENCES groups(id),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages(
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR REFERENCES users(id),
    group_id INTEGER REFERENCES groups(id),
    text VARCHAR NOT NULL,
    image VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts(
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR REFERENCES users(id),
    group_id INTEGER REFERENCES groups(id),
    title VARCHAR NOT NULL,
    body_text VARCHAR NOT NULL,
    image_url VARCHAR,
    file_url VARCHAR,
    file_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Post comments table
CREATE TABLE post_comments(
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR REFERENCES users(id),
    post_id INTEGER REFERENCES posts(id),
    comment_text VARCHAR NOT NULL,
    image_url VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Points table
CREATE TABLE points(
    id SERIAL PRIMARY KEY,
    giver_id VARCHAR REFERENCES users(id),
    recipient_id VARCHAR REFERENCES users(id),
    point_value INTEGER NOT NULL DEFAULT 1,
    messages_id INTEGER REFERENCES messages(id),
    posts_id INTEGER REFERENCES posts(id),
    comment_id INTEGER REFERENCES post_comments(id),
    group_id INTEGER REFERENCES groups(id),
    task_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Badges table
CREATE TABLE badges(
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    criteria VARCHAR NOT NULL,
    point_value INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User badges table
CREATE TABLE user_badges(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    badge_id INTEGER REFERENCES badges(id),
    group_id INTEGER REFERENCES groups(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks(
    id SERIAL PRIMARY KEY,
    task VARCHAR,
    point_value INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User tasks table
CREATE TABLE user_tasks(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id),
    task_id INTEGER REFERENCES tasks(id),
    group_id INTEGER REFERENCES groups(id),
    is_completed BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications(
    id SERIAL PRIMARY KEY,
    message VARCHAR NOT NULL,
    user_id VARCHAR REFERENCES users(id),
    type VARCHAR,
    message_id INTEGER,
    post_id INTEGER,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Awards table
CREATE TABLE awards (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    skill VARCHAR,
    criteria_text TEXT NOT NULL,
    asset_url VARCHAR,
    unwon_asset_url VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User awards table
CREATE TABLE user_awards (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    group_id INTEGER NOT NULL REFERENCES groups(id),
    award_id INTEGER NOT NULL REFERENCES awards(id),
    awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, group_id, award_id)
);

-- Insert some sample data for testing
INSERT INTO users (id, email, username, passhash, created_at, updated_at) 
VALUES ('205851f3-f034-4316-b278-9c962443a5d5', 'nuubi@helper.com', 'NuubiHelper', '$2b$10$example', NOW(), NOW());

INSERT INTO groups (name, description, is_public, created_at, updated_at)
VALUES ('Default Group', 'Welcome to Nuubi!', true, NOW(), NOW());

INSERT INTO participants (user_id, group_id, is_admin, created_at, updated_at)
VALUES ('205851f3-f034-4316-b278-9c962443a5d5', 1, true, NOW(), NOW());

-- Insert some sample awards
INSERT INTO awards (title, skill, criteria_text, asset_url, unwon_asset_url, created_at, updated_at)
VALUES 
('Leadership Award', 'Leadership', 'Create 3+ posts that receive comments from other users', '/assets/leadership.png', '/assets/leadership_gray.png', NOW(), NOW()),
('Teamwork Award', 'Teamwork', 'Comment on 10+ different posts and receive 15+ points', '/assets/teamwork.png', '/assets/teamwork_gray.png', NOW(), NOW()),
('Communication Award', 'Communication', 'Send messages on 10+ different days', '/assets/communication.png', '/assets/communication_gray.png', NOW(), NOW()),
('Reliability Award', 'Reliability', 'Be active for 4+ consecutive weeks', '/assets/reliability.png', '/assets/reliability_gray.png', NOW(), NOW());






