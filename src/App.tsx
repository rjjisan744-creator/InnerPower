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
import { doc, getDoc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
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
          // If we have a firebase user, try to use localStorage as a last resort
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch (e) {}
          }
          return false;
        }
        return prev;
      });
    }, 4000);
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("StatusGuard: Auth state changed", firebaseUser?.uid);
      
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (firebaseUser) {
        // Try to load from localStorage as a fallback while waiting for Firestore
        const storedUserStr = localStorage.getItem('user');
        if (storedUserStr) {
          try {
            const storedUser = JSON.parse(storedUserStr);
            if (storedUser.id === firebaseUser.uid) {
              console.log("StatusGuard: Using cached user as fallback");
              setUser(storedUser);
            }
          } catch (e) {
            console.error("StatusGuard: Failed to parse cached user", e);
          }
        }

        try {
          // Use onSnapshot for real-time status updates (blocked/pending)
          unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
            console.log("StatusGuard: User doc snapshot received", docSnap.exists());
            if (docSnap.exists()) {
              const userData = docSnap.data();
              
              // Auto-promote default admins if they aren't already
              const isAdminEmail = firebaseUser.email === 'rjjisan744@gmail.com' || firebaseUser.email === 'rjjisan744@innerpower.app' || firebaseUser.email === 'admin@innerpower.app';
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
              
              // If this is a known admin email, auto-create the profile
              const isAdminEmail = firebaseUser.email === 'rjjisan744@gmail.com' || firebaseUser.email === 'rjjisan744@innerpower.app' || firebaseUser.email === 'admin@innerpower.app';
              if (isAdminEmail) {
                console.log("StatusGuard: Auto-creating missing admin profile");
                const adminData = {
                  username: firebaseUser.email?.split('@')[0] || 'admin',
                  role: 'admin',
                  status: 'active',
                  is_paid: true,
                  created_at: new Date().toISOString(),
                  email: firebaseUser.email,
                  trial_ends_at: new Date(Date.now() + 86400000 * 365).toISOString() // 1 year for admin
                };
                setDoc(doc(db, 'users', firebaseUser.uid), adminData).catch(err => console.error("Failed to auto-create admin:", err));
                
                const newUser: User = {
                  id: firebaseUser.uid,
                  ...adminData,
                  isTrialExpired: false,
                  trialEndsAt: adminData.trial_ends_at
                } as any;
                setUser(newUser);
              } else {
                setUser(null);
              }
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

  if (loading || (auth.currentUser && !user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-zinc-950 p-4 text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">
          {auth.currentUser ? "প্রোফাইল লোড হচ্ছে..." : "প্রবেশ করা হচ্ছে..."}
        </p>
        
        <div className="mt-8 text-[10px] text-gray-400 font-mono space-y-1">
          <div>Status: {auth.currentUser ? "Syncing Firestore..." : "Checking Auth..."}</div>
          {auth.currentUser && <div>UID: {auth.currentUser.uid}</div>}
        </div>

        <div className="flex flex-col gap-3 mt-8 w-full max-w-xs">
          <button 
            onClick={() => {
              if (auth.currentUser) {
                // If we have a firebase user, try to construct a minimal user object to bypass
                const minimalUser: User = {
                  id: auth.currentUser.uid,
                  username: auth.currentUser.displayName || 'User',
                  role: 'user',
                  status: 'active',
                  isPaid: false,
                  trialEndsAt: new Date(Date.now() + 86400000 * 3).toISOString(),
                  isTrialExpired: false
                };
                setUser(minimalUser);
              }
              setLoading(false);
            }}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20"
          >
            Force Enter App
          </button>
          
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="text-emerald-600 hover:underline text-[10px] font-bold"
            >
              Refresh Page
            </button>
            <button 
              onClick={() => {
                auth.signOut();
                localStorage.removeItem('user');
                window.location.href = '/auth';
              }}
              className="text-red-500 hover:underline text-[10px] font-bold"
            >
              Logout & Reset
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Always allow access to /auth
  if (location.pathname === '/auth') {
    return <>{children}</>;
  }

  if (!user) {
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
