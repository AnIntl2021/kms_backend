CREATE DATABASE IF NOT EXISTS kms_master;
USE kms_master;

SET time_zone = '+03:00';

-- 1. Tenants Table (Registered SaaS restaurants)
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(100) NOT NULL UNIQUE,
  contact_phone VARCHAR(20),
  plan VARCHAR(50) DEFAULT 'Basic', -- 'Basic', 'Pro', 'Enterprise'
  db_name VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'Active', -- 'Active', 'Inactive', 'Suspended'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
) ENGINE=InnoDB;

-- 2. Roles Table for Master DB Administrators
CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  display_name_en VARCHAR(100) NOT NULL,
  display_name_ar VARCHAR(100) NOT NULL,
  permissions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
) ENGINE=InnoDB;

-- 3. Admins Table for SaaS Administrators (Who manage tenants and SaaS dashboards)
CREATE TABLE IF NOT EXISTS admins (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role_id INT,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
) ENGINE=InnoDB;

-- 4. Audit Logs Table (For tracking system admin activity)
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT,
  action VARCHAR(100) NOT NULL,
  entity_name VARCHAR(50),
  entity_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id)
) ENGINE=InnoDB;

-- 5. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  setting_id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(50) NOT NULL UNIQUE,
  setting_value TEXT,
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed Initial SaaS Admin Roles
INSERT IGNORE INTO roles (role_name, display_name_en, display_name_ar, permissions) VALUES 
('super_admin', 'SaaS Master Admin', 'مدير عام السحاب', '["dashboard", "tenants", "users", "settings"]');

-- Seed Default SaaS Master Admin (Password: admin123)
INSERT IGNORE INTO admins (username, email, password, role_id, first_name) 
VALUES ('admin', 'admin@ansoftt.com', '$2b$10$wN1G27K2V9gW21W80n7P/Oi7.P52m1Y5p83s1b5l.X97x012N.2vK', 1, 'Master Admin');

-- Seed System Default Configs
INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES 
('app_version', '1.0.0', 'SaaS platform version'),
('timezone', 'Asia/Kuwait', 'SaaS server default timezone');
