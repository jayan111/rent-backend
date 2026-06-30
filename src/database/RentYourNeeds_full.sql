-- RentYourNeeds Database Complete Backup
-- Database: RentYourNeeds
-- Generated: Complete schema + sample data
-- ===========================================

-- Create Database
CREATE DATABASE IF NOT EXISTS RentYourNeeds
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE RentYourNeeds;

-- ===========================================
-- TABLE: categories
-- ===========================================
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO categories (id, name, description, image, is_active) VALUES
('electronics', 'Electronics', 'Laptops, phones, tablets and more', '/images/electronics.svg', 1),
('photography', 'Photography', 'Cameras, lenses, drones and equipment', '/images/photography.svg', 1),
('furniture', 'Furniture', 'Chairs, desks, sofas and home decor', '/images/furniture.svg', 1),
('vehicles', 'Vehicles', 'Cars, bikes, scooters and transport', '/images/vehicles.svg', 1),
('appliances', 'Appliances', 'Home and kitchen appliances', '/images/appliances.svg', 1),
('gaming', 'Gaming', 'Gaming consoles, PCs and accessories', '/images/gaming.svg', 1);

-- ===========================================
-- TABLE: users
-- ===========================================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar VARCHAR(500),
  role ENUM('user', 'admin') DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Password is 'password123' (bcrypt hash)
INSERT INTO users (id, name, email, password, phone, role, is_active, email_verified) VALUES
('user_1', 'John Doe', 'john@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+91 9876543210', 'user', 1, 1),
('user_2', 'Jane Smith', 'jane@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+91 9876543211', 'user', 1, 1),
('admin_1', 'Admin User', 'admin@rentyourneeds.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+91 9876543212', 'admin', 1, 1);

-- ===========================================
-- TABLE: products
-- ===========================================
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category_id VARCHAR(50),
  stock INT DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,
  reviews INT DEFAULT 0,
  images JSON,
  condition_type ENUM('Excellent', 'Very Good', 'Good', 'Fair') DEFAULT 'Good',
  location VARCHAR(255),
  availability ENUM('available', 'rented', 'maintenance', 'retired') DEFAULT 'available',
  subscription_durations JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

INSERT INTO products (id, name, description, price, category_id, stock, rating, reviews, images, condition_type, location, availability, subscription_durations, is_active) VALUES
('product_1', 'MacBook Pro 16"', 'Powerful laptop with M3 Pro chip, 18GB RAM, 512GB SSD. Perfect for professionals and creative work.', 2500.00, 'electronics', 5, 4.80, 25, '["/uploads/macbook-pro.jpg", "/uploads/macbook-pro-2.jpg"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_2', 'Herman Miller Aeron', 'Ergonomic office chair with lumbar support, fully adjustable. Premium comfort for long work sessions.', 800.00, 'furniture', 10, 4.90, 42, '["/uploads/herman-miller.jpg"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_3', 'Sony A7 IV Camera', 'Full-frame mirrorless camera with 33MP, 4K video recording. Perfect for professional photography.', 3500.00, 'photography', 3, 4.70, 18, '["/uploads/sony-a7iv.jpg"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_4', 'iPhone 15 Pro Max', 'Latest iPhone with A17 Pro chip, 256GB storage, titanium design. Premium smartphone experience.', 1500.00, 'electronics', 15, 4.85, 67, '["/uploads/iphone-15-pro.jpg"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_5', 'Standing Desk', 'Electric height-adjustable desk with memory presets. Switch between sitting and standing effortlessly.', 600.00, 'furniture', 8, 4.60, 31, '["/uploads/standing-desk.jpg"]', 'Very Good', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_6', 'DJI Mavic 3 Pro', 'Professional drone with Hasselblad camera, 4/3 CMOS sensor, 46min flight time.', 4500.00, 'photography', 2, 4.90, 12, '["/uploads/dji-mavic3.jpg"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_7', 'PlayStation 5', 'Next-gen gaming console with ray tracing, 4K gaming, haptic feedback controller.', 700.00, 'gaming', 20, 4.80, 89, '["/uploads/ps5.jpg"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_8', 'Samsung 75" QLED TV', 'Premium 4K QLED smart TV with quantum dot technology, stunning picture quality.', 2000.00, 'electronics', 5, 4.75, 23, '["/uploads/samsung-qled.jpg"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_9', 'Canon EOS R5', 'Professional mirrorless camera with 45MP, 8K video, advanced autofocus system.', 4000.00, 'photography', 3, 4.85, 15, '["/uploads/canon-r5.jpg"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', 1),
('product_10', 'Office Sofa', 'Comfortable 3-seater sofa for office waiting areas or meeting rooms.', 500.00, 'furniture', 6, 4.50, 8, '["/uploads/office-sofa.jpg"]', 'Good', 'Mumbai', 'available', '[3, 6, 12]', 1);

-- ===========================================
-- TABLE: orders
-- ===========================================
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  gst_amount DECIMAL(10, 2) DEFAULT 0,
  status ENUM('pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned') DEFAULT 'pending',
  payment_method ENUM('card', 'upi', 'netbanking', 'wallet') DEFAULT 'card',
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  shipping_address JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO orders (id, user_id, total_amount, gst_amount, status, payment_method, payment_status, shipping_address) VALUES
('order_1', 'user_1', 9900.00, 1782.00, 'delivered', 'card', 'paid', '{"street": "123 Main St", "city": "Mumbai", "state": "Maharashtra", "zipCode": "400001", "country": "India"}'),
('order_2', 'user_2', 4950.00, 891.00, 'active', 'upi', 'paid', '{"street": "456 Oak Ave", "city": "Mumbai", "state": "Maharashtra", "zipCode": "400002", "country": "India"}'),
('order_3', 'user_1', 14850.00, 2673.00, 'confirmed', 'card', 'paid', '{"street": "123 Main St", "city": "Mumbai", "state": "Maharashtra", "zipCode": "400001", "country": "India"}'),
('order_4', 'user_2', 3300.00, 594.00, 'pending', 'netbanking', 'pending', '{"street": "456 Oak Ave", "city": "Mumbai", "state": "Maharashtra", "zipCode": "400002", "country": "India"}');

-- ===========================================
-- TABLE: order_items
-- ===========================================
DROP TABLE IF EXISTS order_items;
CREATE TABLE order_items (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price_per_month DECIMAL(10, 2) NOT NULL,
  tenure_months INT NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

INSERT INTO order_items (id, order_id, product_id, quantity, price_per_month, tenure_months, total_price) VALUES
('item_1', 'order_1', 'product_1', 1, 2500.00, 3, 7500.00),
('item_2', 'order_1', 'product_2', 1, 800.00, 3, 2400.00),
('item_3', 'order_2', 'product_4', 1, 1500.00, 3, 4950.00),
('item_4', 'order_3', 'product_1', 1, 2500.00, 3, 7500.00),
('item_5', 'order_3', 'product_3', 1, 3500.00, 2, 7350.00),
('item_6', 'order_4', 'product_7', 1, 700.00, 3, 3300.00);

-- ===========================================
-- TABLE: subscriptions
-- ===========================================
DROP TABLE IF EXISTS subscriptions;
CREATE TABLE subscriptions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  order_id VARCHAR(50) NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active', 'expired', 'cancelled', 'paused') DEFAULT 'active',
  auto_renew BOOLEAN DEFAULT TRUE,
  total_rented_months INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

INSERT INTO subscriptions (id, user_id, order_id, product_id, start_date, end_date, status, auto_renew, total_rented_months) VALUES
('sub_1', 'user_1', 'order_1', 'product_1', '2025-10-01', '2026-01-01', 'active', 1, 3),
('sub_2', 'user_1', 'order_1', 'product_2', '2025-10-01', '2026-01-01', 'active', 1, 3),
('sub_3', 'user_2', 'order_2', 'product_4', '2025-11-01', '2026-02-01', 'active', 1, 3),
('sub_4', 'user_1', 'order_3', 'product_1', '2025-12-01', '2026-03-01', 'pending', 1, 3);

-- ===========================================
-- TABLE: wishlists
-- ===========================================
DROP TABLE IF EXISTS wishlists;
CREATE TABLE wishlists (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_wishlist (user_id, product_id)
);

INSERT INTO wishlists (id, user_id, product_id) VALUES
('wish_1', 'user_1', 'product_3'),
('wish_2', 'user_1', 'product_6'),
('wish_3', 'user_2', 'product_1'),
('wish_4', 'user_2', 'product_7');

-- ===========================================
-- TABLE: addresses
-- ===========================================
DROP TABLE IF EXISTS addresses;
CREATE TABLE addresses (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  type ENUM('home', 'work', 'other') DEFAULT 'home',
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO addresses (id, user_id, type, street, city, state, zip_code, country, is_default) VALUES
('addr_1', 'user_1', 'home', '123 Main St', 'Mumbai', 'Maharashtra', '400001', 'India', 1),
('addr_2', 'user_1', 'work', '456 Business Park', 'Mumbai', 'Maharashtra', '400002', 'India', 0),
('addr_3', 'user_2', 'home', '456 Oak Ave', 'Mumbai', 'Maharashtra', '400002', 'India', 1);

-- ===========================================
-- TABLE: reviews
-- ===========================================
DROP TABLE IF EXISTS reviews;
CREATE TABLE reviews (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

INSERT INTO reviews (id, user_id, product_id, rating, comment, is_verified_purchase) VALUES
('rev_1', 'user_1', 'product_1', 5, 'Excellent laptop, very fast and reliable for my work!', 1),
('rev_2', 'user_2', 'product_1', 4, 'Great performance but a bit expensive.', 1),
('rev_3', 'user_1', 'product_2', 5, 'Most comfortable chair I have ever used!', 1),
('rev_4', 'user_2', 'product_4', 5, 'Best iPhone ever, camera is amazing!', 1);

-- ===========================================
-- TABLE: payments
-- ===========================================
DROP TABLE IF EXISTS payments;
CREATE TABLE payments (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('card', 'upi', 'netbanking', 'wallet') NOT NULL,
  transaction_id VARCHAR(100),
  status ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

INSERT INTO payments (id, order_id, amount, payment_method, transaction_id, status) VALUES
('pay_1', 'order_1', 11682.00, 'card', 'TXN123456', 'success'),
('pay_2', 'order_2', 5841.00, 'upi', 'UPI789012', 'success'),
('pay_3', 'order_3', 17523.00, 'card', 'TXN345678', 'success');

-- ===========================================
-- COMPLETE: Verify data
-- ===========================================
SELECT 'Categories' as table_name, COUNT(*) as record_count FROM categories
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders
UNION ALL
SELECT 'Order Items', COUNT(*) FROM order_items
UNION ALL
SELECT 'Subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'Wishlists', COUNT(*) FROM wishlists
UNION ALL
SELECT 'Addresses', COUNT(*) FROM addresses
UNION ALL
SELECT 'Reviews', COUNT(*) FROM reviews
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments;

