CREATE DATABASE IF NOT EXISTS fresh_n_fast_db;
USE fresh_n_fast_db;

-- SET TIMEZONE
SET time_zone = '+03:00';

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  display_name_en VARCHAR(100) NOT NULL,
  display_name_ar VARCHAR(100) NOT NULL,
  permissions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_role_name (role_name)
) ENGINE=InnoDB;

-- 2. Admins Table
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
  FOREIGN KEY (role_id) REFERENCES roles(role_id),
  INDEX idx_admin_username (username),
  INDEX idx_admin_email (email)
) ENGINE=InnoDB;

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  parent_id INT DEFAULT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(category_id),
  INDEX idx_cat_parent (parent_id),
  INDEX idx_cat_sort (sort_order)
) ENGINE=InnoDB;

-- 4. Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
  vendor_id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  contact_person VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_vendor_name (name_en)
) ENGINE=InnoDB;

-- 4.5 Branches Table (Multi-Location Support)
CREATE TABLE IF NOT EXISTS branches (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  location_en TEXT,
  location_ar TEXT,
  phone VARCHAR(20),
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_branch_name (name_en)
) ENGINE=InnoDB;

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  sku VARCHAR(50) UNIQUE,
  base_price DECIMAL(10,3) DEFAULT 0.000, -- KWD with 3 decimals
  current_stock DECIMAL(10,3) DEFAULT 0.000,
  min_stock_level DECIMAL(10,3) DEFAULT 10.000,
  unit_en VARCHAR(20) DEFAULT 'units',
  unit_ar VARCHAR(20) DEFAULT 'وحدة',
  sort_order INT DEFAULT 0,
  status ENUM('available', 'out_of_stock', 'discontinued') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  INDEX idx_prod_name_en (name_en),
  INDEX idx_prod_sku (sku),
  INDEX idx_prod_sort (sort_order),
  INDEX idx_prod_status (status)
) ENGINE=InnoDB;

-- 5. Inventory Items (Raw Materials / Stock)
CREATE TABLE IF NOT EXISTS inventory_items (
  inventory_item_id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  sku VARCHAR(50) UNIQUE,
  category_id INT,
  current_stock DECIMAL(10,3) DEFAULT 0.000,
  min_stock_level DECIMAL(10,3) DEFAULT 5.000,
  unit_en VARCHAR(20) DEFAULT 'kg',
  unit_ar VARCHAR(20) DEFAULT 'كجم',
  cost_price DECIMAL(10,3) DEFAULT 0.000,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  INDEX idx_inv_sku (sku),
  INDEX idx_inv_sort (sort_order)
) ENGINE=InnoDB;

-- 5.5 Product Packages
CREATE TABLE IF NOT EXISTS inventory_item_packages (
  package_id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id INT,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  multiplier DECIMAL(10,3) DEFAULT 1.000,
  base_price DECIMAL(10,3) DEFAULT 0.000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id),
  INDEX idx_pkg_item (inventory_item_id)
) ENGINE=InnoDB;

-- 6. Sales Orders
CREATE TABLE IF NOT EXISTS sales_orders (
  sales_order_id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  reference_order_number VARCHAR(100),
  customer_name VARCHAR(255),
  client_phone VARCHAR(50),
  client_address TEXT,
  notes TEXT,
  total_amount DECIMAL(10,3) NOT NULL DEFAULT 0.000, -- KWD
  status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  admin_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id),
  INDEX idx_sales_order_num (order_number),
  INDEX idx_sales_status (status)
) ENGINE=InnoDB;

-- 7. Wastage Tracking
CREATE TABLE IF NOT EXISTS wastage (
  wastage_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  inventory_item_id INT,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  reason_en VARCHAR(255),
  reason_ar VARCHAR(255),
  admin_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id),
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id),
  INDEX idx_wastage_product (product_id),
  INDEX idx_wastage_item (inventory_item_id)
) ENGINE=InnoDB;

-- 8. Audit Logs Table
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
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_action (action)
) ENGINE=InnoDB;

-- 9. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  setting_id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(50) NOT NULL UNIQUE,
  setting_value TEXT,
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB;

-- INITIAL DATA
INSERT IGNORE INTO roles (role_name, display_name_en, display_name_ar) VALUES 
('super_admin', 'Super Admin', 'مدير عام'),
('manager', 'Manager', 'مدير'),
('inventory_controller', 'Inventory Controller', 'مراقب المخزون'),
('sales_dispatch', 'Sales & Dispatch', 'المبيعات والتوزيع');

INSERT IGNORE INTO admins (username, email, password, role_id, first_name) 
VALUES ('admin', 'admin@freshnfast.com', '$2b$10$YourHashedPasswordHere', 1, 'Main Admin');

INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES 
('app_version', '1.0.0', 'Current application version'),
('force_update', 'false', 'Whether to force app update'),
('currency_code', 'KWD', 'Default currency'),
('currency_symbol', 'د.ك', 'Currency symbol'),
('timezone', 'Asia/Kuwait', 'System timezone');

-- 10. Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
  purchase_id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT,
  admin_id INT,
  branch_id INT,
  po_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_type ENUM('tax_invoice', 'simplified_invoice', 'proforma', 'debit_note') DEFAULT 'tax_invoice',
  total_amount DECIMAL(10,3) DEFAULT 0.000,
  tax_amount DECIMAL(10,3) DEFAULT 0.000,
  discount_amount DECIMAL(10,3) DEFAULT 0.000,
  discount_percentage DECIMAL(5,2) DEFAULT 0.00,
  additional_charges DECIMAL(10,3) DEFAULT 0.000,
  final_amount DECIMAL(10,3) DEFAULT 0.000,
  status ENUM('draft', 'pending', 'received', 'partially_received', 'cancelled') DEFAULT 'draft',
  notes TEXT,
  received_at TIMESTAMP NULL,
  received_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id),
  FOREIGN KEY (received_by) REFERENCES admins(admin_id),
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id),
  INDEX idx_po_number (po_number),
  INDEX idx_po_status (status),
  INDEX idx_po_branch (branch_id)
) ENGINE=InnoDB;

-- 11. Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  po_item_id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT,
  inventory_item_id INT,
  variant_id INT NULL,
  package_id INT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(10,3) NOT NULL,
  amount DECIMAL(10,3) DEFAULT 0.000, -- quantity * unit_price
  discount_amount DECIMAL(10,3) DEFAULT 0.000,
  additional_charges_percentage DECIMAL(5,2) DEFAULT 0.00,
  additional_charges_amount DECIMAL(10,3) DEFAULT 0.000,
  final_amount DECIMAL(10,3) DEFAULT 0.000,
  expiry_date DATE NULL,
  total_price DECIMAL(10,3) AS (quantity * unit_price) STORED,
  FOREIGN KEY (purchase_id) REFERENCES purchase_orders(purchase_id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id),
  FOREIGN KEY (package_id) REFERENCES inventory_item_packages(package_id)
) ENGINE=InnoDB;

-- Initial Branch
INSERT IGNORE INTO branches (name_en, name_ar, location_en, location_ar, phone) 
VALUES ('Main Branch', 'الفرع الرئيسي', 'Warehouse Area', 'منطقة المستودعات', '+965-00000000');

-- 12. Menu Items (Selling Products)
CREATE TABLE IF NOT EXISTS menu_items (
  menu_item_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  price DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  cost_price DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  type ENUM('selling', 'premix') DEFAULT 'selling',
  image_url VARCHAR(255),
  status ENUM('available', 'unavailable') DEFAULT 'available',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  INDEX idx_menu_name (name_en)
) ENGINE=InnoDB;

-- 13. Menu Item Ingredients (Recipe System)
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT,
  inventory_item_id INT,
  package_id INT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_en VARCHAR(20),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id)
) ENGINE=InnoDB;

-- 14. Company Assets (Balance Sheet)
CREATE TABLE IF NOT EXISTS company_assets (
  asset_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  value DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  depreciation_rate DECIMAL(5,2) DEFAULT 0.00,
  date_acquired DATE,
  status ENUM('active', 'disposed', 'sold') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
) ENGINE=InnoDB;

-- 15. Company Liabilities (Balance Sheet)
CREATE TABLE IF NOT EXISTS company_liabilities (
  liability_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  amount DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  interest_rate VARCHAR(50),
  due_date DATE,
  status ENUM('active', 'paid') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
) ENGINE=InnoDB;

-- 16. Employees (Payroll)
CREATE TABLE IF NOT EXISTS employees (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_no VARCHAR(50) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  salary DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  allowances JSON,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
) ENGINE=InnoDB;
