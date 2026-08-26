CREATE TABLE IF NOT EXISTS event_staff (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('entry_staff','event_manager') NOT NULL DEFAULT 'entry_staff',
  status TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY event_staff_email_unique (email)
);

CREATE TABLE IF NOT EXISTS event_staff_assignments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_id INT UNSIGNED NOT NULL,
  event_id INT UNSIGNED NOT NULL,
  assigned_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY event_staff_event_unique (staff_id, event_id),
  KEY event_staff_assignment_event (event_id)
);

CREATE TABLE IF NOT EXISTS member_card_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id INT UNSIGNED NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  token_value VARCHAR(128) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  last_scanned_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY member_card_token_hash_unique (token_hash),
  KEY member_card_member_active (member_id, is_active)
);

CREATE TABLE IF NOT EXISTS event_checkins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  registration_id INT UNSIGNED NOT NULL,
  member_id VARCHAR(255) NULL,
  event_id INT UNSIGNED NOT NULL,
  staff_id INT UNSIGNED NULL,
  actor_type ENUM('staff','admin','member') NOT NULL DEFAULT 'staff',
  actor_name VARCHAR(255) NULL,
  qr_type ENUM('EVENT_QR','MEMBER_CARD_QR','MANUAL') NOT NULL,
  checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','reversed') NOT NULL DEFAULT 'active',
  reversed_by INT UNSIGNED NULL,
  reversed_at DATETIME NULL,
  reverse_reason VARCHAR(500) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY event_checkins_registration_status (registration_id, status),
  KEY event_checkins_event_time (event_id, checked_in_at)
);
