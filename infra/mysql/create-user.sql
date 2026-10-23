-- Run once as the MySQL root user on a native install (docs/setup.md):
--   mysql -u root -p < infra/mysql/create-user.sql
-- Creates the user stl (password stl) at localhost and 127.0.0.1 only, never '%'
-- (AD-15), with every privilege on stl and stl_test. dbmate creates both
-- databases on its first `up`. Compose users skip this file: infra/compose.yaml
-- creates its own user inside the container.

CREATE USER IF NOT EXISTS 'stl'@'localhost' IDENTIFIED BY 'stl';
CREATE USER IF NOT EXISTS 'stl'@'127.0.0.1' IDENTIFIED BY 'stl';

-- The underscore is escaped so the grant names stl_test exactly, not a pattern.
GRANT ALL PRIVILEGES ON `stl`.* TO 'stl'@'localhost';
GRANT ALL PRIVILEGES ON `stl`.* TO 'stl'@'127.0.0.1';
GRANT ALL PRIVILEGES ON `stl\_test`.* TO 'stl'@'localhost';
GRANT ALL PRIVILEGES ON `stl\_test`.* TO 'stl'@'127.0.0.1';
