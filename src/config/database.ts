import mysql from 'mysql2/promise';

let connection: mysql.Connection | null = null;

export const connectDB = async () => {
  try {
    // Railway MySQL plugin can expose vars in multiple formats — try all of them
    const mysqlUrl =
      process.env.MYSQL_URL ||
      process.env.MYSQL_PRIVATE_URL ||
      process.env.MYSQL_PUBLIC_URL ||
      process.env.DATABASE_URL;

    const host     = process.env.DB_HOST     || process.env.MYSQLHOST     || process.env.MYSQL_HOST     || 'localhost';
    const user     = process.env.DB_USER     || process.env.MYSQLUSER     || process.env.MYSQL_USER     || 'root';
    const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '';
    const database = process.env.DB_NAME     || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'rentyourneeds';
    const port     = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306');

    // Log what we're attempting (hide password)
    if (mysqlUrl) {
      const safeUrl = mysqlUrl.replace(/:([^@]+)@/, ':***@');
      console.log(`🔌 Connecting via URL: ${safeUrl}`);
      connection = await mysql.createConnection(mysqlUrl);
    } else {
      console.log(`🔌 Connecting to MySQL: ${user}@${host}:${port}/${database}`);
      connection = await mysql.createConnection({ host, user, password, database, port });
    }

    await createTables();
    console.log('✓ MySQL connected successfully');
    console.log('✓ Database tables ready');
  } catch (error) {
    const err = error as any;
    console.error('✗ MySQL connection failed');
    console.error('  Error code   :', err.code);
    console.error('  Error message:', err.message);
    console.error('  Available DB env vars:', {
      MYSQL_URL:        !!process.env.MYSQL_URL,
      MYSQL_PRIVATE_URL:!!process.env.MYSQL_PRIVATE_URL,
      DATABASE_URL:     !!process.env.DATABASE_URL,
      DB_HOST:          process.env.DB_HOST,
      MYSQLHOST:        process.env.MYSQLHOST,
      MYSQL_HOST:       process.env.MYSQL_HOST,
      DB_NAME:          process.env.DB_NAME,
      MYSQLDATABASE:    process.env.MYSQLDATABASE,
      MYSQL_DATABASE:   process.env.MYSQL_DATABASE,
    });
    console.log('Server will continue without database');
  }
};

const createTables = async () => {
  if (!connection) {
    console.error('Cannot create tables: no database connection');
    return;
  }

  const tables = [
    // Categories table
    `CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      image VARCHAR(500),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
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
    )`,
    
    // Products table
    `CREATE TABLE IF NOT EXISTS products (
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
      FOREIGN KEY (category_id) REFERENCES categories(id),
      INDEX idx_category (category_id),
      INDEX idx_price (price),
      INDEX idx_availability (availability)
    )`,
    
    // Orders table
    `CREATE TABLE IF NOT EXISTS orders (
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
    )`,
    
    // Subscriptions table
    `CREATE TABLE IF NOT EXISTS subscriptions (
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
    )`,

    // Inventory table
    `CREATE TABLE IF NOT EXISTS inventory (
      id VARCHAR(50) PRIMARY KEY,
      product_id VARCHAR(50) NOT NULL,
      serial_number VARCHAR(100),
      status ENUM('available', 'rented', 'maintenance', 'damaged') DEFAULT 'available',
      condition_notes TEXT,
      location VARCHAR(100),
      assigned_order_id VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      INDEX idx_product_id (product_id),
      INDEX idx_status (status)
    )`,

    // Maintenance requests table
    `CREATE TABLE IF NOT EXISTS maintenance_requests (
      id VARCHAR(50) PRIMARY KEY,
      subscription_id VARCHAR(50),
      user_id VARCHAR(50) NOT NULL,
      product_id VARCHAR(50) NOT NULL,
      inventory_id VARCHAR(50),
      issue TEXT NOT NULL,
      priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
      status ENUM('pending', 'scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_user_id (user_id),
      INDEX idx_status (status)
    )`,

    // Damage reports table
    `CREATE TABLE IF NOT EXISTS damage_reports (
      id VARCHAR(50) PRIMARY KEY,
      inventory_id VARCHAR(50) NOT NULL,
      subscription_id VARCHAR(50),
      user_id VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      severity ENUM('minor', 'major', 'total_loss') NOT NULL,
      repair_cost DECIMAL(10, 2) DEFAULT 0,
      charged_amount DECIMAL(10, 2) DEFAULT 0,
      images JSON,
      status ENUM('reported', 'assessed', 'charged', 'resolved') DEFAULT 'reported',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_user_id (user_id),
      INDEX idx_status (status)
    )`,

    // Admin settings table
    `CREATE TABLE IF NOT EXISTS admin_settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      \`value\` TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // KYC verifications table
    `CREATE TABLE IF NOT EXISTS kyc_verifications (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50),
      user_email VARCHAR(255) NOT NULL,
      document_type ENUM('aadhaar', 'pan', 'driving_license', 'passport') NOT NULL,
      document_number VARCHAR(100) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      date_of_birth DATE NOT NULL,
      address TEXT,
      status ENUM('pending', 'under_review', 'verified', 'rejected') DEFAULT 'pending',
      rejection_reason TEXT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_email (user_email),
      INDEX idx_status (status)
    )`
  ];

  for (const table of tables) {
    await connection.execute(table);
  }

  // Add columns that may be missing from tables created before schema updates
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token VARCHAR(500)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_durations JSON`,
  ];
  for (const m of migrations) {
    try { await connection.execute(m); } catch (_) { /* ignore if already exists */ }
  }

  // Insert default categories
  await connection.execute(`
    INSERT IGNORE INTO categories (id, name, description, image) VALUES
    ('electronics', 'Electronics', 'Laptops, phones, tablets and more', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400'),
    ('photography', 'Photography', 'Cameras, lenses, drones and equipment', 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=400'),
    ('furniture', 'Furniture', 'Chairs, desks, sofas and home decor', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400'),
    ('vehicles', 'Vehicles', 'Cars, bikes, scooters and transport', 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400')
  `);
};

export const getDB = async (): Promise<mysql.Connection | null> => {
  return connection;
};

export default { connectDB, getDB };