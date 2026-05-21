-- AirWatch Eswatini — Database Setup
-- Run this once in phpMyAdmin or MySQL CLI:
--   SOURCE /path/to/db_setup.sql;

CREATE DATABASE IF NOT EXISTS airwatch_eswatini
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE airwatch_eswatini;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(80)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  password_hash VARCHAR(64)  NOT NULL,
  role          ENUM('admin','environmental_officer','researcher') NOT NULL DEFAULT 'researcher',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Air quality readings
CREATE TABLE IF NOT EXISTS air_quality_data (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  date        DATE         NOT NULL,
  month       TINYINT      NOT NULL,
  year        SMALLINT     NOT NULL,
  day_of_week TINYINT      NOT NULL,
  location    VARCHAR(50)  NOT NULL,
  pm25        FLOAT        NOT NULL,
  pm10        FLOAT,
  no2         FLOAT,
  co          FLOAT,
  aqi_category VARCHAR(20),
  UNIQUE KEY uq_date_location (date, location)
);

-- Stored predictions
CREATE TABLE IF NOT EXISTS predictions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  zone            VARCHAR(50)  NOT NULL,
  forecast_date   DATE         NOT NULL,
  predicted_pm25  FLOAT        NOT NULL,
  category        VARCHAR(20),
  model_used      VARCHAR(80),
  created_by      VARCHAR(80),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Industrial monitoring zones
CREATE TABLE IF NOT EXISTS zones (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO zones (name) VALUES ('Matsapha'), ('Simunye'), ('Bhunya');

-- Seed admin account
-- Password: admin123  (SHA-256 hash)
INSERT IGNORE INTO users (username, name, password_hash, role)
VALUES (
  'admin',
  'System Administrator',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'admin'
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  actor      VARCHAR(80)  NOT NULL,
  action     VARCHAR(80)  NOT NULL,
  details    TEXT,
  ip         VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System configuration (key-value store)
CREATE TABLE IF NOT EXISTS system_config (
  `key`      VARCHAR(80) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Training history (one row per training run)
CREATE TABLE IF NOT EXISTS training_history (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  run_id           VARCHAR(30)  NOT NULL UNIQUE,
  trained_at       DATETIME     NOT NULL,
  trained_by       VARCHAR(80),
  best_model       VARCHAR(80),

  -- dataset split
  dataset_rows     INT,
  train_samples    INT,
  test_samples     INT,

  -- Random Forest hyperparameters
  n_estimators     INT,
  max_depth        INT,
  min_samples      INT,

  -- SVR hyperparameters
  svr_c            FLOAT,
  svr_epsilon      FLOAT,
  svr_kernel       VARCHAR(20),

  -- Random Forest test metrics
  rf_mae           FLOAT,
  rf_rmse          FLOAT,
  rf_r2            FLOAT,

  -- Random Forest train metrics
  rf_train_mae     FLOAT,
  rf_train_rmse    FLOAT,
  rf_train_r2      FLOAT,

  -- SVR test metrics
  svr_mae          FLOAT,
  svr_rmse         FLOAT,
  svr_r2           FLOAT,

  -- SVR train metrics
  svr_train_mae    FLOAT,
  svr_train_rmse   FLOAT,
  svr_train_r2     FLOAT,

  -- filesystem snapshot path and active flag
  model_dir        VARCHAR(255),
  is_active        TINYINT(1)   NOT NULL DEFAULT 0
);

-- Default page visibility per role (JSON)
INSERT IGNORE INTO system_config (`key`, value) VALUES
(
  'page_visibility',
  '{"environmental_officer":["overview","historical","upload","train","predict","report","notifications","model-report"],"researcher":["overview","historical","predict","report","model-report"]}'
);
