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
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
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
    
    // Safety timeout to prevent stuck loading
    const timeoutId = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("StatusGuard: Loading timeout reached, forcing finish");
          return false;
        }
        return prev;
      });
    }, 6000);
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("StatusGuard: Auth state changed", firebaseUser?.uid);
      
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (firebaseUser) {
        try {
          // Use onSnapshot for real-time status updates (blocked/pending)
          unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
            console.log("StatusGuard: User doc snapshot received", docSnap.exists());
            if (docSnap.exists()) {
              const userData = docSnap.data();
              
              // Auto-promote default admins if they aren't already
              const isAdminEmail = firebaseUser.email === 'rjjisan744@gmail.com';
              const isAdminUsername = userData.username === 'admin' || userData.username === 'rjjisan744';
              const shouldBeAdmin = isAdminEmail || isAdminUsername;
              
              if (shouldBeAdmin && userData.role !== 'admin') {
                console.log("StatusGuard: Promoting user to admin role");
                updateDoc(docSnap.ref, { role: 'admin' }).catch(err => console.error("Failed to promote user:", err));
                userData.role = 'admin';
              }

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
              console.warn("StatusGuard: User doc does not exist for UID:", firebaseUser.uid);
              setUser(null);
            }
            setLoading(false);
            clearTimeout(timeoutId);
          }, (error) => {
            console.error("StatusGuard: Firestore listener error:", error);
            setLoading(false);
            clearTimeout(timeoutId);
          });
        } catch (error) {
          console.error("StatusGuard: Auth state sync error:", error);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } else {
        console.log("StatusGuard: No firebase user, clearing session");
        localStorage.removeItem('user');
        setUser(null);
        setLoading(false);
        clearTimeout(timeoutId);
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/auth' && user) {
      setUser(null);
    }
  }, [location.pathname, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-zinc-950 p-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">প্রবেশ করা হচ্ছে...</p>
        <div className="mt-8 text-[10px] text-gray-400 font-mono">
          Status: {auth.currentUser ? "Authenticating..." : "Checking session..."}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 text-emerald-600 hover:underline text-xs"
        >
          Refresh Page
        </button>
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
