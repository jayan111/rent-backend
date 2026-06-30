-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
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
  subscription_durations JSON, -- [3, 6, 12, 24, 36]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_category (category_id),
  INDEX idx_price (price),
  INDEX idx_availability (availability)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  address JSON,
  is_active BOOLEAN DEFAULT TRUE,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  refresh_token VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50),
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_phone VARCHAR(20),
  items JSON NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  subscription_type ENUM('one-time', 'recurring') NOT NULL,
  tenure_months INT,
  status ENUM('pending', 'confirmed', 'processing', 'delivered', 'active', 'cancelled', 'returned') DEFAULT 'pending',
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  payment_intent_id VARCHAR(255),
  subscription_id VARCHAR(255),
  delivery_address JSON NOT NULL,
  tracking_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_user_email (user_email),
  INDEX idx_user_phone (user_phone),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  order_id VARCHAR(50) NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  status ENUM('active', 'paused', 'cancelled', 'expired') DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  tenure_months INT NOT NULL,
  monthly_amount DECIMAL(10, 2) NOT NULL,
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- Insert default categories
INSERT IGNORE INTO categories (id, name, description, image) VALUES
('electronics', 'Electronics', 'Laptops, phones, tablets and more', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400'),
('photography', 'Photography', 'Cameras, lenses, drones and equipment', 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=400'),
('furniture', 'Furniture', 'Chairs, desks, sofas and home decor', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400'),
('vehicles', 'Vehicles', 'Cars, bikes, scooters and transport', 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400');