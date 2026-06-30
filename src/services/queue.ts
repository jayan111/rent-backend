import Bull from 'bull';
import { queueRedis } from '../config/redis';

// Create queues
export const emailQueue = new Bull('email processing', {
  redis: {
    host: queueRedis.options.host,
    port: queueRedis.options.port,
    password: queueRedis.options.password
  }
});

export const inventoryQueue = new Bull('inventory processing', {
  redis: {
    host: queueRedis.options.host,
    port: queueRedis.options.port,
    password: queueRedis.options.password
  }
});

export const analyticsQueue = new Bull('analytics processing', {
  redis: {
    host: queueRedis.options.host,
    port: queueRedis.options.port,
    password: queueRedis.options.password
  }
});

// Job processors
emailQueue.process('send-notification', async (job) => {
  const { to, subject, message, type } = job.data;
  
  console.log(`📧 Processing email: ${type} to ${to}`);
  
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log(`✅ Email sent: ${subject}`);
  return { sent: true, to, subject };
});

inventoryQueue.process('update-inventory', async (job) => {
  const { productId, action, quantity } = job.data;
  
  console.log(`📦 Processing inventory update: ${action} for product ${productId}`);
  
  // Simulate inventory update
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`✅ Inventory updated for product ${productId}`);
  return { updated: true, productId, action };
});

analyticsQueue.process('track-event', async (job) => {
  const { event, userId, data } = job.data;
  
  console.log(`📊 Processing analytics: ${event} for user ${userId}`);
  
  // Simulate analytics processing
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log(`✅ Analytics tracked: ${event}`);
  return { tracked: true, event, userId };
});

// Queue helpers
export const addJob = {
  email: (data: any, options = {}) => emailQueue.add('send-notification', data, options),
  inventory: (data: any, options = {}) => inventoryQueue.add('update-inventory', data, options),
  analytics: (data: any, options = {}) => analyticsQueue.add('track-event', data, options)
};

// Queue monitoring
const logQueueEvents = (queue: Bull.Queue, name: string) => {
  queue.on('completed', (job) => {
    console.log(`✅ ${name} job ${job.id} completed`);
  });
  
  queue.on('failed', (job, err) => {
    console.error(`❌ ${name} job ${job.id} failed:`, err.message);
  });
};

logQueueEvents(emailQueue, 'Email');
logQueueEvents(inventoryQueue, 'Inventory');
logQueueEvents(analyticsQueue, 'Analytics');

export { emailQueue as default };