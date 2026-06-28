export interface Category {
  id: number;
  name: string;
  is_locked: boolean;
  password?: string;
  lock_message?: string;
  sort_index: number;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
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
  profile_picture?: string;
  booksReadCount?: number;
  currentlyReading?: string;
  referralCode?: string;
  referredBy?: string;
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
  id: string;
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
