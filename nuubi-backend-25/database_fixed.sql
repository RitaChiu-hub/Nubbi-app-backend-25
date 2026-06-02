-- Enable citext and pgcrypto extensions
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Users table (ID is VARCHAR to support UUIDs/Auth0 IDs)
CREATE TABLE users(
                      id VARCHAR PRIMARY KEY,
                      email citext NOT NULL UNIQUE,
                      username VARCHAR(255) NOT NULL UNIQUE,
                      passhash VARCHAR,
                      avatar_url VARCHAR,
                      last_signin TIMESTAMP,
                      uuid UUID UNIQUE DEFAULT gen_random_uuid(),
                      push_notification_token VARCHAR(255),
                      created_via_canvas BOOLEAN DEFAULT FALSE,
                      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Groups table
CREATE TABLE groups(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'untitled group',
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    invite_passcode VARCHAR,
    canvas_course_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Participants (Joins users and groups)
CREATE TABLE participants(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Posts table
CREATE TABLE posts(
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    body_text TEXT NOT NULL,
    image_url VARCHAR,
    file_url VARCHAR,
    file_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. Messages table
CREATE TABLE messages(
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    image VARCHAR, -- Storing URL
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. Post Comments table
CREATE TABLE post_comments(
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    image_url VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. View Logs (For Analytics)
CREATE TABLE view_logs(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL, -- 'message' or 'post'
    content_id INTEGER NOT NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    device_type VARCHAR(20) NOT NULL,
    platform VARCHAR(20),
    viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. Badges
CREATE TABLE badges(
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    criteria TEXT NOT NULL,
    point_value INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. User Badges
CREATE TABLE user_badges(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. Tasks
CREATE TABLE tasks(
    id SERIAL PRIMARY KEY,
    task VARCHAR NOT NULL,
    point_value INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. User Tasks
CREATE TABLE user_tasks(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. Points table
CREATE TABLE points(
    id SERIAL PRIMARY KEY,
    giver_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    recipient_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    point_value INTEGER NOT NULL DEFAULT 1,
    messages_id INTEGER REFERENCES messages(id),
    posts_id INTEGER REFERENCES posts(id),
    comment_id INTEGER REFERENCES post_comments(id),
    task_id INTEGER REFERENCES tasks(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 13. Notifications
CREATE TABLE notifications(
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 14. Awards
CREATE TABLE awards (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    skill VARCHAR, -- e.g. Initiative & Peer Leadership
    criteria_text TEXT NOT NULL,
    asset_url VARCHAR,
    unwon_asset_url VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 15. User Awards
CREATE TABLE user_awards (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    award_id INTEGER NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
    awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, group_id, award_id)
);

-- 16. User Sessions (Missing from original but needed for Analytics)
CREATE TABLE user_sessions (
    session_id VARCHAR PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    active_seconds INTEGER DEFAULT 0,
    device_type VARCHAR(50),
    platform VARCHAR(50),
    ip_address VARCHAR(50),
    country_code VARCHAR(10),
    pages_viewed INTEGER DEFAULT 0,
    posts_viewed_count INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    connection_drops INTEGER DEFAULT 0
);

-- 17. User Session Totals (For caching analytics performance)
CREATE TABLE user_session_totals (
    user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_active_seconds INTEGER DEFAULT 0,
    total_pages_viewed INTEGER DEFAULT 0,
    total_posts_viewed INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    total_connection_drops INTEGER DEFAULT 0,
    last_active_at TIMESTAMP NOT NULL DEFAULT NOW()
);
