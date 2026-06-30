import bcrypt from 'bcryptjs';

interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  created_at: Date;
}

export const createAdminUser = async (): Promise<User> => {
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  console.log('='.repeat(50));
  console.log('🔐 ADMIN CREDENTIALS CREATED');
  console.log('='.repeat(50));
  console.log('Email: admin@rentyourneeds.com');
  console.log('Password: admin123');
  console.log('Role: admin');
  console.log('='.repeat(50));
  
  return {
    id: 'admin_1',
    email: 'admin@rentyourneeds.com',
    password: adminPassword,
    name: 'Super Admin',
    role: 'admin' as const,
    created_at: new Date()
  };
};

export const createTestUser = async (): Promise<User> => {
  const userPassword = await bcrypt.hash('user123', 10);
  
  console.log('👤 TEST USER CREDENTIALS');
  console.log('Email: user@rentyourneeds.com');
  console.log('Password: user123');
  console.log('Role: user');
  console.log('='.repeat(50));
  
  return {
    id: 'user_1',
    email: 'user@rentyourneeds.com',
    password: userPassword,
    name: 'Test User',
    role: 'user' as const,
    created_at: new Date()
  };
};