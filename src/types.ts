export interface Category {
  id: number;
  name: string;
  is_locked: boolean;
  password?: string;
  sort_index: number;
  created_at: string;
}

export interface Note {
  id: number;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  password?: string;
  role: 'user' | 'admin';
  status: 'pending' | 'active' | 'blocked';
  isPaid: boolean;
  isTrialExpired: boolean;
  hasPendingSubscription?: boolean;
  trialEndsAt: string;
  device_id?: string;
  created_at?: string;
  fullName?: string;
  email?: string;
  profilePicture?: string;
  booksReadCount?: number;
  currentlyReading?: string;
  referralCode?: string;
  referredBy?: number;
  referralCount?: number;
  referralStats?: {
    granted_count: number;
    pending_count: number;
  };
  last_login_at?: string;
  last_active_at?: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  notes?: string;
  notes_count?: number;
}

export interface Book {
  id: number;
  title: string;
  author?: string;
  description: string;
  cover_url: string;
  content: string; // This will store the JSON string of pages
  category?: string;
  pdf_url?: string;
  pages?: string[]; // Helper for frontend
  sort_index?: number;
  created_at: string;
}

export type Language = 'en' | 'bn';
export type Theme = 'light' | 'dark';
