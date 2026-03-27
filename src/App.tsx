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

const StatusGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Use onSnapshot for real-time status updates (blocked/pending)
          const unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data();
              const updatedUser: User = {
                id: docSnap.id,
                username: userData.username || '',
                role: userData.role || 'user',
                status: userData.status || 'pending',
                isPaid: !!userData.is_paid,
                trialEndsAt: userData.trial_ends_at || '',
                isTrialExpired: userData.trial_ends_at ? new Date(userData.trial_ends_at) < new Date() : false,
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
          return () => unsubDoc();
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

    return () => unsubscribe();
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
    if (user.status === 'pending' || user.status === 'inactive') {
      return <PendingActivationPage />;
    }

    // If trial expired and not paid, they can only access home and profile
    const isTrialExpired = user.trialEndsAt ? new Date(user.trialEndsAt) < new Date() : user.isTrialExpired;
    const isExpired = isTrialExpired && !user.isPaid;
    const restrictedPaths = ['/book/'];
    const isRestrictedPath = restrictedPaths.some(path => location.pathname.startsWith(path)) && !location.pathname.endsWith('/info');
    
    if (isExpired && isRestrictedPath) {
      localStorage.removeItem('user');
      return <Navigate to="/auth" replace />;
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
