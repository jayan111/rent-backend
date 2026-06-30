import { getDB } from './src/config/database';

async function insertTestOrder() {
  try {
    const db = await getDB();
    
    const orderId = `order_${Date.now()}`;
    const items = [
      {
        id: 1,
        product: {
          id: 1,
          name: 'MacBook Pro 16"',
          description: 'High-performance laptop',
          price: 5000,
          image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8'
        },
        quantity: 1,
        tenureMonths: 3
      }
    ];
    
    const deliveryAddress = {
      street: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001'
    };
    
    await db.query(
      `INSERT INTO orders (id, user_id, user_name, user_email, items, total_amount, subscription_type, tenure_months, status, payment_status, payment_intent_id, delivery_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        'guest',
        'Test User',
        'test@example.com',
        JSON.stringify(items),
        15000,
        'one-time',
        3,
        'confirmed',
        'paid',
        'test_session_123',
        JSON.stringify(deliveryAddress)
      ]
    );
    
    console.log('Test order created:', orderId);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

insertTestOrder();
