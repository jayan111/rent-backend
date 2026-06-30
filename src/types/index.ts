import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    phone?: string;
    role?: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: Address;
  kycStatus: 'pending' | 'verified' | 'rejected';
  kycDocuments: KYCDocument[];
  creditScore?: number;
  role?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface KYCDocument {
  type: 'aadhar' | 'pan' | 'driving_license';
  number: string;
  imageUrl: string;
  verified: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  specifications: Record<string, any>;
  images: string[];
  monthlyRent: number;
  securityDeposit: number;
  minRentalPeriod: number;
  maxRentalPeriod: number;
  condition: 'new' | 'refurbished' | 'good';
  status: 'available' | 'rented' | 'maintenance' | 'retired';
  totalStock: number;
  availableStock: number;
  location: string;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  productId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  securityDeposit: number;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  nextBillingDate: Date;
  autoRenewal: boolean;
  deliveryAddress: Address;
  created_at: Date;
  updated_at: Date;
}

export interface Payment {
  id: string;
  subscriptionId: string;
  userId: string;
  amount: number;
  type: 'rent' | 'deposit' | 'damage' | 'late_fee' | 'refund';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'card' | 'upi' | 'netbanking' | 'wallet';
  transactionId?: string;
  dueDate: Date;
  paidDate?: Date;
  created_at: Date;
}

export interface Order {
  id: string;
  subscriptionId: string;
  userId: string;
  productId: string;
  type: 'delivery' | 'pickup' | 'maintenance' | 'relocation';
  status: 'pending' | 'scheduled' | 'in_transit' | 'delivered' | 'completed' | 'cancelled';
  scheduledDate: Date;
  completedDate?: Date;
  deliveryAddress: Address;
  notes?: string;
  assignedAgent?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Inventory {
  id: string;
  productId: string;
  serialNumber: string;
  condition: 'new' | 'refurbished' | 'good' | 'damaged';
  status: 'available' | 'rented' | 'maintenance' | 'retired';
  currentUserId?: string;
  purchaseDate: Date;
  purchasePrice: number;
  totalRentals: number;
  lastMaintenanceDate?: Date;
  location: string;
  created_at: Date;
  updated_at: Date;
}

export interface MaintenanceRequest {
  id: string;
  subscriptionId: string;
  userId: string;
  productId: string;
  inventoryId: string;
  issue: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate?: Date;
  completedDate?: Date;
  cost?: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Damage {
  id: string;
  inventoryId: string;
  subscriptionId: string;
  userId: string;
  description: string;
  severity: 'minor' | 'major' | 'total_loss';
  repairCost: number;
  chargedAmount: number;
  images: string[];
  status: 'reported' | 'assessed' | 'charged' | 'resolved';
  created_at: Date;
  updated_at: Date;
}