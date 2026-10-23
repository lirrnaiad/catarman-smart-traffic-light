-- migrate:up

-- The five M1 tables (spine, Structural Seed: Data model). Every *_at column is a
-- UTC DATETIME(3) (AD-6). The only foreign key is breach_crop -> breach_event (AD-10).

CREATE TABLE vehicle_count (
  id BIGINT NOT NULL AUTO_INCREMENT,
  msg_id CHAR(36) NOT NULL,
  approach CHAR(1) NOT NULL,
  vehicle_class VARCHAR(32) NOT NULL,
  count INT NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  received_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_count_msg (msg_id, approach, vehicle_class),
  KEY ix_vehicle_count_occurred_at (occurred_at),
  KEY ix_vehicle_count_received_at (received_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE signal_state_change (
  id BIGINT NOT NULL AUTO_INCREMENT,
  level VARCHAR(16) NOT NULL,
  signal_ns VARCHAR(16) NOT NULL,
  signal_ew VARCHAR(16) NOT NULL,
  flood VARCHAR(16) NOT NULL,
  fault BOOLEAN NOT NULL,
  override_mode VARCHAR(16) NULL,
  override_phase VARCHAR(2) NULL,
  override_command_id CHAR(36) NULL,
  received_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_signal_state_change_received_at (received_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE breach_event (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id CHAR(36) NOT NULL,
  approach CHAR(1) NOT NULL,
  vehicle_class VARCHAR(32) NOT NULL,
  centroid_x DOUBLE NOT NULL,
  centroid_y DOUBLE NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  received_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_breach_event_event_id (event_id),
  KEY ix_breach_event_occurred_at (occurred_at),
  KEY ix_breach_event_received_at (received_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE breach_crop (
  breach_event_id BIGINT NOT NULL,
  mime VARCHAR(32) NOT NULL,
  data MEDIUMBLOB NOT NULL,
  PRIMARY KEY (breach_event_id),
  CONSTRAINT fk_breach_crop_breach_event FOREIGN KEY (breach_event_id)
    REFERENCES breach_event (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE override_command (
  id BIGINT NOT NULL AUTO_INCREMENT,
  command_id CHAR(36) NOT NULL,
  mode VARCHAR(16) NOT NULL,
  phase VARCHAR(2) NULL,
  status VARCHAR(16) NOT NULL,
  reason VARCHAR(32) NULL,
  requested_at DATETIME(3) NOT NULL,
  resolved_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_override_command_command_id (command_id),
  KEY ix_override_command_requested_at (requested_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- migrate:down

DROP TABLE breach_crop;
DROP TABLE breach_event;
DROP TABLE override_command;
DROP TABLE signal_state_change;
DROP TABLE vehicle_count;
