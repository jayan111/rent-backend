import { Response } from 'express';

const clients = new Map<string, Response>();

export const addSSEClient = (id: string, res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial ping
  res.write('event: ping\ndata: connected\n\n');

  clients.set(id, res);

  res.on('close', () => {
    clients.delete(id);
  });
};

export const removeSSEClient = (id: string): void => {
  clients.delete(id);
};

export const broadcast = (event: string, data: any): void => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      // Client disconnected
    }
  });
};

export const notifyOrderUpdate = (orderId: string, status: string, extra?: any): void => {
  broadcast('orderUpdate', { orderId, status, timestamp: new Date().toISOString(), ...extra });
};

// Keep-alive ping every 30 seconds
setInterval(() => {
  const pingPayload = 'event: ping\ndata: keep-alive\n\n';
  clients.forEach((res) => {
    try {
      res.write(pingPayload);
    } catch {
      // Client disconnected
    }
  });
}, 30000);
