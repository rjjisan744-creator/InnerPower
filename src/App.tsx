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

export const AUTHORIZED_ADMIN_EMAILS = [
  'rjjisan744@gmail.com',
  'rjjisan744@innerpower.app',
  'admin@innerpower.app'
];

const StatusGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    // If on auth page or have cached user, don't show global loader immediately
    return window.location.pathname !== '/auth' && !localStorage.getItem('user');
  });
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
    }, 5000); // Reduced to 5 seconds for better UX
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("StatusGuard: Auth state changed", firebaseUser?.uid, "Email:", firebaseUser?.email, "Verified:", firebaseUser?.emailVerified);
      
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (firebaseUser) {
        // Fallback to localStorage if Firestore is slow
        const storedUserStr = localStorage.getItem('user');
        if (storedUserStr) {
          try {
            const storedUser = JSON.parse(storedUserStr);
            if (storedUser.id === firebaseUser.uid) {
              setUser(storedUser);
              setLoading(false);
            }
          } catch (e) {}
        }

        try {
          // Use onSnapshot for real-time status updates (blocked/pending)
          unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
            console.log("StatusGuard: User doc snapshot received", docSnap.exists());
            if (docSnap.exists()) {
              const userData = docSnap.data();
              
              // Auto-promote default admins if they aren't already
              // SECURITY: Must have authorized email. Primary email doesn't require verification to bootstrap.
              const isAdminEmail = (firebaseUser.email === 'rjjisan744@gmail.com') || 
                                   (['rjjisan744@innerpower.app', 'admin@innerpower.app'].includes(firebaseUser.email || '') && firebaseUser.emailVerified);
              
              if (isAdminEmail && userData.role !== 'admin') {
                const sessionKey = `promoted_${firebaseUser.uid}`;
                if (!sessionStorage.getItem(sessionKey)) {
                  console.log("StatusGuard: Promoting authorized verified email to admin role");
                  updateDoc(docSnap.ref, { role: 'admin' }).then(() => {
                    sessionStorage.setItem(sessionKey, 'true');
                  }).catch(err => {
                    if (err.code === 'resource-exhausted') {
                      sessionStorage.setItem(sessionKey, 'true'); // Don't retry this session
                    }
                    console.error("Failed to promote user:", err);
                  });
                }
                userData.role = 'admin';
              } else if (!isAdminEmail && userData.role === 'admin') {
                const sessionKey = `demoted_${firebaseUser.uid}`;
                if (!sessionStorage.getItem(sessionKey)) {
                  console.warn("StatusGuard: Unauthorized admin detected, demoting to user role");
                  updateDoc(docSnap.ref, { role: 'user' }).then(() => {
                    sessionStorage.setItem(sessionKey, 'true');
                  }).catch(err => {
                    if (err.code === 'resource-exhausted') {
                      sessionStorage.setItem(sessionKey, 'true'); // Don't retry this session
                    }
                    console.error("Failed to demote user:", err);
                  });
                }
                userData.role = 'user';
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
              const isAdminEmail = (firebaseUser.email === 'rjjisan744@gmail.com') || 
                                   (['rjjisan744@innerpower.app', 'admin@innerpower.app'].includes(firebaseUser.email || '') && firebaseUser.emailVerified);
              
              if (isAdminEmail) {
                const sessionKey = `created_${firebaseUser.uid}`;
                const adminData = {
                  username: firebaseUser.email?.split('@')[0] || 'admin',
                  role: 'admin',
                  status: 'active',
                  is_paid: true,
                  created_at: new Date().toISOString(),
                  email: firebaseUser.email,
                  trial_ends_at: new Date(Date.now() + 86400000 * 365).toISOString() // 1 year for admin
                };

                if (!sessionStorage.getItem(sessionKey)) {
                  console.log("StatusGuard: Auto-creating missing admin profile");
                  setDoc(doc(db, 'users', firebaseUser.uid), adminData).then(() => {
                    sessionStorage.setItem(sessionKey, 'true');
                  }).catch(err => {
                    if (err.code === 'resource-exhausted') {
                      sessionStorage.setItem(sessionKey, 'true');
                    }
                    console.error("Failed to auto-create admin:", err);
                  });
                }
                
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

  // Always allow access to /auth
  if (location.pathname === '/auth') {
    return <>{children}</>;
  }

  if (loading || (auth.currentUser && !user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-zinc-950 p-6 text-center">
        <div className="relative mb-8">
          <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">প্রোফাইল লোড হচ্ছে</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto mb-8">
          আপনার অ্যাকাউন্ট যাচাই করা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।
          <br />
          <span className="text-[10px] opacity-70">
            (যদি অনেক সময় নেয়, তবে আপনার ব্রাউজারের Ad-blocker বা Brave Shields বন্ধ করে রিফ্রেশ করুন)
          </span>
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <div className="flex items-center justify-center gap-6 mt-4">
            <button 
              onClick={() => window.location.reload()}
              className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-semibold"
            >
              রিফ্রেশ করুন
            </button>
            <button 
              onClick={() => setLoading(false)}
              className="text-zinc-400 hover:underline text-[10px] font-semibold"
            >
              স্কিপ করুন (জরুরী)
            </button>
            <button 
              onClick={() => {
                auth.signOut();
                localStorage.removeItem('user');
                window.location.href = '/auth';
              }}
              className="text-red-500 hover:underline text-xs font-semibold"
            >
              লগআউট করুন
            </button>
          </div>
        </div>

        {/* Hidden technical info for debugging if needed */}
        <div className="mt-12 pt-8 border-t border-gray-100 dark:border-zinc-800 w-full max-w-xs opacity-0 hover:opacity-100 transition-opacity">
          <div className="text-[10px] text-gray-400 font-mono space-y-1">
            <div>Status: {auth.currentUser ? "Syncing Firestore..." : "Checking Auth..."}</div>
            {auth.currentUser && <div>Session: {auth.currentUser.uid.substring(0, 8)}...</div>}
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
    
    // If not admin and trying to access admin panel, redirect to home
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/" replace />;
    }
    
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
