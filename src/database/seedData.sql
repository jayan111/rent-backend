-- Seed Data for RentYourNeeds Database
-- Run this AFTER importing schema.sql

-- ============================================
-- USERS
-- ============================================
INSERT INTO users (id, name, email, phone, password, role, address, is_active, created_at) VALUES
('user_001', 'John Doe', 'john@example.com', '+919876543210', '$2b$10$abcdefghijklmnopqrstuv', 'user', '{"street": "123 Main St", "city": "Mumbai", "state": "Maharashtra", "zipCode": "400001", "country": "India"}', TRUE, NOW()),
('user_002', 'Jane Smith', 'jane@example.com', '+919876543211', '$2b$10$abcdefghijklmnopqrstuv', 'user', '{"street": "456 Oak Ave", "city": "Delhi", "state": "Delhi", "zipCode": "110001", "country": "India"}', TRUE, NOW()),
('user_003', 'Admin User', 'admin@rentyourneeds.com', '+919876543212', '$2b$10$abcdefghijklmnopqrstuv', 'admin', '{"street": "789 Tech Park", "city": "Bangalore", "state": "Karnataka", "zipCode": "560001", "country": "India"}', TRUE, NOW());

-- ============================================
-- CATEGORIES (Already inserted by schema, but adding more)
-- ============================================
INSERT INTO categories (id, name, description, image, is_active) VALUES
('electronics', 'Electronics', 'Laptops, phones, tablets and more', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400', TRUE),
('photography', 'Photography', 'Cameras, lenses, drones and equipment', 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=400', TRUE),
('furniture', 'Furniture', 'Chairs, desks, sofas and home decor', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', TRUE),
('vehicles', 'Vehicles', 'Cars, bikes, scooters and transport', 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400', TRUE),
('appliances', 'Home Appliances', 'Kitchen and home appliances', 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400', TRUE),
('gaming', 'Gaming', 'Gaming consoles and accessories', 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=400', TRUE);

-- ============================================
-- PRODUCTS
-- ============================================
INSERT INTO products (id, name, description, price, category_id, stock, rating, reviews, images, condition_type, location, availability, subscription_durations, is_active) VALUES
('prod_001', 'MacBook Pro 16"', 'Apple MacBook Pro with M3 Max chip, 36GB RAM, 1TB SSD. Perfect for professionals and creators.', 2500, 'electronics', 5, 4.8, 24, '["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800", "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', TRUE),
('prod_002', 'Herman Miller Aeron', 'Ergonomic office chair with adjustable lumbar support and breathable mesh.', 800, 'furniture', 10, 4.9, 56, '["https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=800"]', 'Excellent', 'Delhi', 'available', '[3, 6, 12]', TRUE),
('prod_003', 'Sony A7 IV Camera', 'Full-frame mirrorless camera with 33MP sensor and 4K video recording.', 1500, 'photography', 3, 4.7, 18, '["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800", "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800"]', 'Very Good', 'Bangalore', 'available', '[3, 6, 12]', TRUE),
('prod_004', 'iPhone 15 Pro Max', 'Latest Apple iPhone with A17 Pro chip, 256GB storage.', 1200, 'electronics', 15, 4.6, 42, '["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', TRUE),
('prod_005', 'Standing Desk Electric', 'Height adjustable electric standing desk, 60" x 30" with memory presets.', 600, 'furniture', 8, 4.5, 31, '["https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800"]', 'Good', 'Delhi', 'available', '[3, 6, 12]', TRUE),
('prod_006', 'DJI Mavic 3 Pro', 'Professional drone with Hasselblad camera, 4/3 CMOS sensor.', 2000, 'photography', 2, 4.8, 12, '["https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800"]', 'Excellent', 'Bangalore', 'available', '[3, 6, 12]', TRUE),
('prod_007', 'PlayStation 5', 'Sony PS5 Gaming Console with 825GB SSD and controller.', 700, 'gaming', 20, 4.7, 89, '["https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800"]', 'Excellent', 'Mumbai', 'available', '[3, 6, 12]', TRUE),
('prod_008', 'Samsung 55" QLED TV', '4K QLED Smart TV with Quantum Processor and Dolby Atmos.', 900, 'electronics', 6, 4.4, 27, '["https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800"]', 'Very Good', 'Delhi', 'available', '[3, 6, 12]', TRUE),
('prod_009', 'Canon EOS R5', 'Full-frame mirrorless camera, 45MP, 8K video recording.', 1800, 'photography', 4, 4.9, 15, '["https://images.unsplash.com/photo-1519638831568-d9897f54ed69?w=800"]', 'Excellent', 'Bangalore', 'available', '[3, 6, 12]', TRUE),
('prod_010', 'Office Sofa 3-Seater', 'Modern leather sofa, comfortable and elegant for office reception.', 1100, 'furniture', 5, 4.3, 8, '["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800"]', 'Good', 'Mumbai', 'available', '[3, 6, 12]', TRUE);

-- ============================================
-- ORDERS
-- ============================================
INSERT INTO orders (id, user_id, user_name, user_email, user_phone, items, total_amount, subscription_type, tenure_months, status, payment_status, payment_intent_id, delivery_address, created_at) VALUES
('ord_001', 'user_001', 'John Doe', 'john@example.com', '+919876543210', '[{"id":"item_001","productId":"prod_001","product":{"id":"prod_001","name":"MacBook Pro 16\"","price":2500},"quantity":1,"tenureMonths":3}]', 7500, 'one-time', 3, 'delivered', 'paid', 'pi_abc123', '{"street":"123 Main St","city":"Mumbai","state":"Maharashtra","zipCode":"400001","country":"India"}', DATE_SUB(NOW(), INTERVAL 30 DAY)),
('ord_002', 'user_001', 'John Doe', 'john@example.com', '+919876543210', '[{"id":"item_002","productId":"prod_002","product":{"id":"prod_002","name":"Herman Miller Aeron","price":800},"quantity":1,"tenureMonths":6}]', 4800, 'one-time', 6, 'active', 'paid', 'pi_def456', '{"street":"123 Main St","city":"Mumbai","state":"Maharashtra","zipCode":"400001","country":"India"}', DATE_SUB(NOW(), INTERVAL 15 DAY)),
('ord_003', 'user_002', 'Jane Smith', 'jane@example.com', '+919876543211', '[{"id":"item_003","productId":"prod_003","product":{"id":"prod_003","name":"Sony A7 IV Camera","price":1500},"quantity":1,"tenureMonths":3}]', 4500, 'one-time', 3, 'confirmed', 'paid', 'pi_ghi789', '{"street":"456 Oak Ave","city":"Delhi","state":"Delhi","zipCode":"110001","country":"India"}', DATE_SUB(NOW(), INTERVAL 7 DAY)),
('ord_004', 'user_002', 'Jane Smith', 'jane@example.com', '+919876543211', '[{"id":"item_004","productId":"prod_007","product":{"id":"prod_007","name":"PlayStation 5","price":700},"quantity":1,"tenureMonths":12}]', 8400, 'recurring', 12, 'pending', 'pending', NULL, '{"street":"456 Oak Ave","city":"Delhi","state":"Delhi","zipCode":"110001","country":"India"}', NOW());

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
INSERT INTO subscriptions (id, user_id, order_id, product_id, status, start_date, end_date, tenure_months, monthly_amount, stripe_subscription_id, created_at) VALUES
('sub_001', 'user_001', 'ord_001', 'prod_001', 'expired', DATE_SUB(DATE_SUB(NOW(), INTERVAL 30 DAY), INTERVAL 3 MONTH), DATE_SUB(NOW(), INTERVAL 30 DAY), 3, 2500, 'sub_abc123', DATE_SUB(NOW(), INTERVAL 30 DAY)),
('sub_002', 'user_001', 'ord_002', 'prod_002', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 15 DAY), INTERVAL 6 MONTH), 6, 800, 'sub_def456', DATE_SUB(NOW(), INTERVAL 15 DAY)),
('sub_003', 'user_002', 'ord_003', 'prod_003', 'active', NOW(), DATE_ADD(NOW(), INTERVAL 3 MONTH), 3, 1500, 'sub_ghi789', NOW()),
('sub_004', 'user_002', 'ord_004', 'prod_007', 'pending', NOW(), DATE_ADD(NOW(), INTERVAL 12 MONTH), 12, 700, NULL, NOW());

