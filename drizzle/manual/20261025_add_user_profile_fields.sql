ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name varchar(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data text;
