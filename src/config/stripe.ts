import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export const STRIPE_CONFIG = {
  currency: 'inr',
  successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/checkout/success',
  cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/checkout/cancel',
};

export default stripe;