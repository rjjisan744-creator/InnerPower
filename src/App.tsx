import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './AppContext';
import { AuthPage } from './AuthPage';
import { HomePage } from './HomePage';
import { ReaderPage } from './ReaderPage';
import { AdminPanelPage } from './AdminPanelPage';
import { ProfilePage } from './ProfilePage';
import { BookInfoPage } from './BookInfoPage';
import { PendingActivationPage } from './PendingActivationPage';
import { BlockedAccountPage } from './BlockedAccountPage';
import { User } from './types';

import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';

const safeDate = (date: any) => {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  if (date && typeof date === 'object' && 'seconds' in date) {
    return new Date(date.seconds * 1000);
  }
  if (date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

const StatusGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (firebaseUser) {
        try {
          // Use onSnapshot for real-time status updates (blocked/pending)
          unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data();
              const trialEndsAt = userData.trial_ends_at || '';
              const isTrialExpired = trialEndsAt ? safeDate(trialEndsAt) < new Date() : false;

              const updatedUser: User = {
                id: docSnap.id,
                username: userData.username || '',
                role: userData.role || 'user',
                status: userData.status || 'pending',
                isPaid: !!userData.is_paid,
                hasPendingSubscription: !!userData.has_pending_subscription,
                trialEndsAt: trialEndsAt,
                isTrialExpired: isTrialExpired,
                ...userData
              };
              localStorage.setItem('user', JSON.stringify(updatedUser));
              setUser(updatedUser);
            } else {
              // User exists in Auth but not in Firestore (shouldn't happen normally)
              setUser(null);
            }
            setLoading(false);
          }, (error) => {
            console.error("Firestore listener error:", error);
            setLoading(false);
          });
        } catch (error) {
          console.error("Auth state sync error:", error);
          setLoading(false);
        }
      } else {
        localStorage.removeItem('user');
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/auth' && user) {
      setUser(null);
    }
  }, [location.pathname, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Always allow access to /auth
  if (location.pathname === '/auth') {
    return <>{children}</>;
  }

  if (!user) {
    // Check if there's a user in localStorage. If so, we might be about to load it.
    const storedUser = localStorage.getItem('user');
    if (storedUser && location.pathname !== '/auth') {
      return (
        <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return <Navigate to="/auth" replace />;
  }

  if (user) {
    if (user.role === 'admin') return <>{children}</>;
    
    if (user.status === 'blocked') {
      return <BlockedAccountPage />;
    }

    // If trial expired and not paid, they can only access home and profile
    const isTrialExpired = user.trialEndsAt ? new Date(user.trialEndsAt) < new Date() : user.isTrialExpired;
    const isExpired = isTrialExpired && !user.isPaid;

    if ((user.status === 'pending' || user.status === 'inactive') && isExpired) {
      return <PendingActivationPage />;
    }

    const restrictedPaths = ['/book/'];
    const isRestrictedPath = restrictedPaths.some(path => location.pathname.startsWith(path)) && !location.pathname.endsWith('/info');
    
    if (isExpired && isRestrictedPath) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AppProvider>
      <Router>
        <StatusGuard>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/book/:id" element={<ReaderPage />} />
            <Route path="/book/:id/info" element={<BookInfoPage />} />
            <Route path="/admin" element={<AdminPanelPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </StatusGuard>
      </Router>
    </AppProvider>
  );
}
