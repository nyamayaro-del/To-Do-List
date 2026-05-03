-- Run this once against the todo_app database if your users table already exists.
-- This version is safe for existing rows: it creates temporary placeholder
-- emails before enforcing NOT NULL + UNIQUE.
ALTER TABLE users
  ADD COLUMN email VARCHAR(255) NULL AFTER username;

UPDATE users
SET email = CONCAT('user', id, '@todo.local')
WHERE email IS NULL OR email = '';

ALTER TABLE users
  MODIFY email VARCHAR(255) NOT NULL;

ALTER TABLE users
  ADD UNIQUE KEY users_email_unique (email);

-- Reference shape for a fresh users table:
-- CREATE TABLE users (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   username VARCHAR(100) NOT NULL UNIQUE,
--   email VARCHAR(255) NOT NULL UNIQUE,
--   password VARCHAR(255) NOT NULL
-- );
