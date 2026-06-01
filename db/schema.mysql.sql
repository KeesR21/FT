-- FTPR Lions Academy — MySQL 8+ / MariaDB 10.5+ (Hostinger, local, etc.)
--
-- Apply once:
--   npm run db:setup:mysql
-- Or paste into phpMyAdmin / Hostinger → Databases → phpMyAdmin → SQL

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role ENUM('super_admin', 'editor', 'photographer') NOT NULL DEFAULT 'editor',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parents (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  parent_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_parents_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS players (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  parent_id CHAR(36) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  age_group VARCHAR(32) NOT NULL,
  height_cm DECIMAL(5,2) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  profile_photo_url TEXT NULL,
  status ENUM('active', 'withdrawn') NOT NULL DEFAULT 'active',
  registration_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  development_notes TEXT NULL,
  registration_profile JSON NOT NULL,
  subscription_valid_until DATE NULL,
  withdrawn_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_players_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE,
  CONSTRAINT chk_players_height CHECK (height_cm > 0 AND height_cm < 320),
  CONSTRAINT chk_players_weight CHECK (weight_kg > 0 AND weight_kg < 250),
  UNIQUE KEY uq_players_parent_name_dob (parent_id, player_name, date_of_birth),
  KEY idx_players_parent (parent_id),
  KEY idx_players_age_group (age_group),
  KEY idx_players_registration_status (registration_status),
  KEY idx_players_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  player_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'RWF',
  payment_for VARCHAR(255) NOT NULL,
  paid_at DATETIME(3) NULL,
  due_date DATE NOT NULL,
  verified_by_user_id CHAR(36) NULL,
  verified_by_label VARCHAR(255) NULL,
  status ENUM('paid', 'not_paid', 'pending', 'overdue', 'expiring_soon') NOT NULL DEFAULT 'not_paid',
  payment_method VARCHAR(64) NULL,
  payment_notes TEXT NULL,
  mobile_money_ref VARCHAR(128) NULL,
  proof_url TEXT NULL,
  invoice_sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_payments_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_user FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payments_amount CHECK (amount >= 0),
  KEY idx_payments_player (player_id),
  KEY idx_payments_status (status),
  KEY idx_payments_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timetable_sessions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL DEFAULT '',
  age_group VARCHAR(32) NOT NULL,
  age_groups JSON NOT NULL,
  kind ENUM('training', 'match') NOT NULL DEFAULT 'training',
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NOT NULL,
  location_name VARCHAR(255) NOT NULL,
  kit_requirements TEXT NOT NULL,
  trainer_name VARCHAR(255) NOT NULL DEFAULT '',
  activities JSON NOT NULL,
  session_objectives TEXT NOT NULL,
  equipment_notes TEXT NOT NULL,
  instructor_notes TEXT NOT NULL,
  is_updated TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sessions_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_session_window CHECK (ends_at > starts_at),
  KEY idx_sessions_age_group (age_group),
  KEY idx_sessions_starts (starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS performance_entries (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  player_id CHAR(36) NOT NULL,
  happened_on DATE NOT NULL,
  notes TEXT NOT NULL,
  focus_area VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_performance_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  KEY idx_performance_player (player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_messages (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  channel ENUM('individual', 'group') NOT NULL,
  player_id CHAR(36) NULL,
  age_group VARCHAR(32) NULL,
  subject VARCHAR(512) NOT NULL,
  body TEXT NOT NULL,
  sent_by VARCHAR(255) NOT NULL,
  CONSTRAINT fk_messages_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  KEY idx_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_config (
  id TINYINT PRIMARY KEY,
  content JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT site_config_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO site_config (id, content) VALUES (1, JSON_OBJECT())
ON DUPLICATE KEY UPDATE id = id;

SET FOREIGN_KEY_CHECKS = 1;
