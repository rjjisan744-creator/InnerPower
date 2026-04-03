import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from './AppContext';
import { LogIn, UserPlus, Shield, FileText, X, MessageSquare, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SupportContactModal } from './components/SupportContactModal';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  fetchSignInMethodsForEmail,
  signInAnonymously
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  limit,
  updateDoc,
  serverTimestamp,
  increment,
  runTransaction,
  getDocFromCache,
  getDocFromServer
} from 'firebase/firestore';

// Error handling helper
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return JSON.stringify(errInfo);
};

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(() => {
    return localStorage.getItem('has_registered') === 'true';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const { t } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
      setIsLogin(false);
    }
    
    if (location.state?.error) {
      setError(location.state.error);
      setShowErrorDialog(true);
      setDialogType('blocked');
    }

    // Sign in anonymously for support chat if not logged in
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(err => {
        console.warn("Anonymous sign-in failed (might be expected if already logged in or network issue):", err);
      });
    }
  }, [location.search, location.state]);

  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'blocked' | 'pending'>('blocked');
  const [authText, setAuthText] = useState('');
  const [smsSupportNumber, setSmsSupportNumber] = useState('');
  const [showAuthTextModal, setShowAuthTextModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  useEffect(() => {
    if (isLogin || !username || username.length < 3) {
      setIsUsernameAvailable(null);
      setUsernameSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const sanitized = username.toLowerCase().replace(/\s+/g, '');
        if (sanitized.length < 3) {
          setIsUsernameAvailable(null);
          setIsCheckingUsername(false);
          return;
        }
        
        // Check database (usernames collection)
        const usernameDoc = await getDoc(doc(db, "usernames", sanitized));
        if (usernameDoc.exists()) {
          setIsUsernameAvailable(false);
          const suggestions = [
            `${sanitized}${Math.floor(Math.random() * 999)}`,
            `${sanitized}_${Math.random().toString(36).substring(2, 5)}`,
            `user_${sanitized}`,
            `${sanitized}24`
          ];
          setUsernameSuggestions(suggestions);
          setIsCheckingUsername(false);
          return;
        }

        // Check Auth system
        const email = sanitized.includes('@') ? sanitized : `${sanitized}@innerpower.app`;
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0) {
          setIsUsernameAvailable(false);
          const suggestions = [
            `${sanitized}${Math.floor(Math.random() * 999)}`,
            `${sanitized}_${Math.random().toString(36).substring(2, 5)}`,
            `user_${sanitized}`,
            `${sanitized}24`
          ];
          setUsernameSuggestions(suggestions);
          setIsCheckingUsername(false);
          return;
        }

        setIsUsernameAvailable(true);
        setUsernameSuggestions([]);
        setError(''); // Clear any registration errors if username becomes available
      } catch (err) {
        console.error("Error checking username:", err);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      // We don't reset isCheckingUsername here because the next effect will start soon
    };
  }, [username, isLogin]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'settings', 'auth_text'));
        console.log("Firestore connection successful");
      } catch (error: any) {
        console.error("Firestore connection test failed:", error);
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const authTextDoc = await getDoc(doc(db, 'settings', 'auth_text'));
        if (authTextDoc.exists()) {
          setAuthText(authTextDoc.data().value || '');
        }
        
        const smsSupportDoc = await getDoc(doc(db, 'settings', 'sms_support_number'));
        if (smsSupportDoc.exists()) {
          setSmsSupportNumber(smsSupportDoc.data().value || '');
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const getDeviceId = () => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'web-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError("সব ঘর পূরণ করুন");
      return;
    }

    if (password.length < 6) {
      setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }
    
    if (!isLogin && isUsernameAvailable === false) {
      setError("এই ইউজারনেমটি ইতিমধ্যে ব্যবহার করা হয়েছে। দয়া করে অন্য একটি নাম চেষ্টা করুন অথবা লগইন করুন।");
      return;
    }
    
    const deviceId = getDeviceId();
    const sanitizedUsername = username.toLowerCase().replace(/\s+/g, '');
    
    if (!isLogin) {
      setIsCheckingUsername(true);
      try {
        // 1. Check usernames collection
        const usernameRef = doc(db, 'usernames', sanitizedUsername);
        const usernameDoc = await getDoc(usernameRef);
        if (usernameDoc.exists()) {
          setError("এই ইউজারনেমটি ইতিমধ্যে ব্যবহার করা হয়েছে। দয়া করে অন্য একটি নাম চেষ্টা করুন অথবা লগইন করুন।");
          setIsUsernameAvailable(false);
          setIsCheckingUsername(false);
          return;
        }

        // 2. Check Auth system
        const emailCheck = `${sanitizedUsername}@innerpower.app`;
        const methods = await fetchSignInMethodsForEmail(auth, emailCheck);
        if (methods.length > 0) {
          setError("এই ইউজারনেমটি ইতিমধ্যে ব্যবহার করা হয়েছে। দয়া করে অন্য একটি নাম চেষ্টা করুন অথবা লগইন করুন।");
          setIsUsernameAvailable(false);
          setIsCheckingUsername(false);
          return;
        }
      } catch (err) {
        console.error("Error double checking username:", err);
      } finally {
        setIsCheckingUsername(false);
      }
    }

    const email = sanitizedUsername.includes('@') ? sanitizedUsername : `${sanitizedUsername}@innerpower.app`;

    try {
      if (isLogin) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
          
          if (!userDoc.exists()) {
            // If user doc doesn't exist but auth succeeded, create it
            const trialEnds = new Date();
            trialEnds.setDate(trialEnds.getDate() + 3);
            const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const newUserData = {
              username: sanitizedUsername,
              password,
              role: 'user',
              status: 'active',
              is_paid: false,
              device_id: deviceId,
              created_at: serverTimestamp(),
              trial_ends_at: trialEnds.toISOString(),
              referral_code: myReferralCode,
              referral_count: 0,
              referred_by: null
            };
            
            await setDoc(doc(db, 'users', userCredential.user.uid), newUserData);
            
            const userObj = {
              id: userCredential.user.uid,
              username: newUserData.username,
              role: newUserData.role,
              status: newUserData.status,
              isPaid: false,
              isTrialExpired: false,
              trialEndsAt: newUserData.trial_ends_at,
              email: email,
              referralCode: newUserData.referral_code,
              referralCount: 0
            };
            
            localStorage.setItem('user', JSON.stringify(userObj));
            localStorage.setItem('has_registered', 'true');
            navigate('/');
            return;
          }

          const userData = userDoc.data();
          
          // Update device ID and last login
          await updateDoc(doc(db, 'users', userCredential.user.uid), {
            device_id: deviceId,
            last_login_at: serverTimestamp(),
            last_active_at: serverTimestamp()
          });

          const now = new Date();
          const trialEnds = userData.trial_ends_at ? new Date(userData.trial_ends_at) : new Date(0);
          const isTrialExpired = now > trialEnds;

          const userObj = {
            id: userCredential.user.uid,
            username: userData.username,
            role: userData.role,
            status: userData.status,
            isPaid: !!userData.is_paid,
            isTrialExpired,
            trialEndsAt: userData.trial_ends_at,
            fullName: userData.full_name,
            email: userData.email,
            profilePicture: userData.profile_picture,
            referralCode: userData.referral_code,
            referralCount: userData.referral_count,
            referredBy: userData.referred_by,
            notes: userData.notes
          };

          localStorage.setItem('user', JSON.stringify(userObj));
          localStorage.setItem('has_registered', 'true');
          navigate('/');
        } catch (authErr: any) {
          console.error("Login error:", authErr);
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
            setError("ভুল ইউজারনেম বা পাসওয়ার্ড। দয়া করে সঠিক তথ্য দিন।");
          } else if (authErr.code === 'auth/operation-not-allowed') {
            setError("Firebase সেটিংস সমস্যা: দয়া করে Firebase Console থেকে Email/Password মেথডটি Enable করুন। এটি ছাড়া অ্যাপ কাজ করবে না।");
          } else if (authErr.code === 'auth/too-many-requests') {
            setError("অনেকবার ভুল চেষ্টা করা হয়েছে। অ্যাকাউন্টটি সাময়িকভাবে লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।");
          } else if (authErr.code === 'auth/network-request-failed') {
            setError("ইন্টারনেট সংযোগে সমস্যা হচ্ছে। দয়া করে আপনার ইন্টারনেট কানেকশন চেক করুন অথবা কোনো অ্যাড-ব্লকার (Ad-blocker) থাকলে তা বন্ধ করে আবার চেষ্টা করুন।");
          } else {
            setError(`লগইন করতে সমস্যা হচ্ছে: ${authErr.message}`);
          }
        }
      } else {
        // Register
        try {
          // Early check for username availability in Firestore
          const usernameRef = doc(db, 'usernames', sanitizedUsername);
          const usernameDoc = await getDoc(usernameRef);
          if (usernameDoc.exists()) {
            setError("এই ইউজারনেমটি ইতিমধ্যে ব্যবহার করা হয়েছে। দয়া করে অন্য একটি নাম চেষ্টা করুন অথবা লগইন করুন।");
            setIsUsernameAvailable(false);
            return;
          }

          // Check if device already has an account to prevent multi-accounts
          const deviceRef = doc(db, 'device_ids', deviceId);
          const deviceDoc = await getDoc(deviceRef);
          const isMultiAccount = deviceDoc.exists();

          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const trialEnds = new Date();
          trialEnds.setDate(trialEnds.getDate() + 3);
          
          const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          
          const userData = {
            username: sanitizedUsername,
            password, // Store password as requested for admin view
            role: 'user',
            status: isMultiAccount ? 'blocked' : 'active',
            block_reason: isMultiAccount ? 'multi_account' : null,
            is_paid: false,
            device_id: deviceId,
            created_at: serverTimestamp(),
            trial_ends_at: trialEnds.toISOString(),
            referral_code: myReferralCode,
            referral_count: 0,
            referred_by: null
          };

          try {
            // Use a transaction to ensure username is unique and recorded
            await runTransaction(db, async (transaction) => {
              const usernameRef = doc(db, 'usernames', sanitizedUsername);
              const usernameDoc = await transaction.get(usernameRef);
              
              if (usernameDoc.exists()) {
                throw new Error("Username already taken");
              }
              
              transaction.set(usernameRef, { uid: userCredential.user.uid });
              transaction.set(doc(db, 'users', userCredential.user.uid), userData);

              // Record device ID if it's the first account for this device
              if (!isMultiAccount) {
                transaction.set(deviceRef, {
                  uid: userCredential.user.uid,
                  username: sanitizedUsername,
                  created_at: serverTimestamp()
                });
              }
            });

            // Handle referral
            if (referralCode) {
              console.log("AuthPage: Processing referral code:", referralCode);
              const q = query(collection(db, "users"), where("referral_code", "==", referralCode), limit(1));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const referrerDoc = querySnapshot.docs[0];
                const referrerData = referrerDoc.data();
                console.log("AuthPage: Referrer found:", referrerData.username);
                
                if (referrerData.referral_count < 10) {
                  await runTransaction(db, async (transaction) => {
                    transaction.update(doc(db, 'users', referrerDoc.id), {
                      referral_count: increment(1)
                    });
                    
                    const referralRef = doc(collection(db, 'referrals'));
                    transaction.set(referralRef, {
                      referrer_id: referrerDoc.id,
                      referrer_username: referrerData.username || 'Unknown',
                      referee_id: userCredential.user.uid,
                      referee_username: sanitizedUsername,
                      bonus_granted: false,
                      created_at: serverTimestamp()
                    });

                    transaction.update(doc(db, 'users', userCredential.user.uid), {
                      referred_by: referrerDoc.id,
                      trial_ends_at: new Date(new Date().setDate(new Date().getDate() + 6)).toISOString()
                    });
                  });
                  console.log("AuthPage: Referral transaction completed successfully");
                } else {
                  console.warn("AuthPage: Referrer has reached max referral limit (10)");
                }
              } else {
                console.warn("AuthPage: Invalid referral code - no user found");
              }
            }

            localStorage.setItem('has_registered', 'true');
            setIsLogin(true);
            setError('রেজিস্ট্রেশন সফল হয়েছে। এখন লগইন করুন।');
          } catch (fsErr: any) {
            const detailedError = handleFirestoreError(fsErr, OperationType.WRITE, `users/${userCredential.user.uid}`);
            setError(`ডাটাবেসে তথ্য সেভ করতে সমস্যা হয়েছে: ${detailedError}`);
            
            // Cleanup orphaned Auth account if Firestore setup failed
            try {
              await userCredential.user.delete();
              console.log("Cleaned up orphaned Auth account after Firestore failure");
            } catch (delErr) {
              console.error("Failed to delete orphaned user:", delErr);
            }
          }
        } catch (authErr: any) {
          console.error("Registration error:", authErr);
          const errCode = authErr?.code || '';
          const errMsg = authErr?.message || String(authErr);
          const isEmailInUse = errCode === 'auth/email-already-in-use' || 
                               errMsg.includes('auth/email-already-in-use') ||
                               errCode === 'auth/account-exists-with-different-credential';
          
          if (isEmailInUse) {
            setError(
              <div className="flex flex-col items-center gap-2">
                <span>দুঃখিত, এই ইউজারনেমটি আমাদের সিস্টেমে ইতিমধ্যে নিবন্ধিত।</span>
                <button 
                  onClick={() => setIsLogin(true)}
                  className="bg-white/20 hover:bg-white/30 px-4 py-1 rounded-full text-[10px] transition-all"
                >
                  সরাসরি লগইন করুন
                </button>
              </div>
            );
            setIsUsernameAvailable(false);
            
            // Generate better suggestions
            const suggestions = [
              `${sanitizedUsername}${Math.floor(Math.random() * 999)}`,
              `${sanitizedUsername}_${Math.random().toString(36).substring(2, 5)}`,
              `user_${sanitizedUsername}`,
              `${sanitizedUsername}24`
            ];
            setUsernameSuggestions(suggestions);
            
            // Scroll to top to show error
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (errCode === 'auth/operation-not-allowed') {
            setError("Firebase সেটিংস সমস্যা: দয়া করে Firebase Console থেকে Email/Password মেথডটি Enable করুন।");
          } else if (errCode === 'auth/weak-password') {
            setError("পাসওয়ার্ডটি খুব দুর্বল। কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।");
          } else if (errCode === 'auth/network-request-failed') {
            setError("ইন্টারনেট সংযোগ নেই। দয়া করে আপনার কানেকশন চেক করুন।");
          } else {
            setError(`রেজিস্ট্রেশন করতে সমস্যা হচ্ছে: ${errMsg}`);
          }
        }
      }
    } catch (err: any) {
      console.error("Submit error:", err);
      setError("সার্ভার থেকে ভুল রেসপন্স এসেছে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
  };

  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleAdminAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const allowedAdminEmails = ['rjjisan744@gmail.com', 'rjjisan744@innerpower.app', 'admin@innerpower.app'];
    if (allowedAdminEmails.includes(adminEmail) && adminPassword === '445566') {
      const email = adminEmail;
      try {
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, email, adminPassword);
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
            try {
              userCredential = await createUserWithEmailAndPassword(auth, email, adminPassword);
            } catch (createErr: any) {
              if (createErr.code === 'auth/email-already-in-use') {
                // If it already exists, then the original sign-in failed because of wrong password
                throw authErr;
              }
              throw createErr;
            }
          } else {
            throw authErr;
          }
        }

        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        
        let userData = userDoc.exists() ? userDoc.data() : null;
        
        if (!userData) {
          // If user doc doesn't exist, create it as admin
          userData = {
            username: 'admin',
            role: 'admin',
            status: 'active',
            is_paid: true,
            created_at: serverTimestamp(),
            email: email,
            password: adminPassword
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), userData);
        } else if (userData.role !== 'admin') {
          // If user exists but is not admin, promote them
          await updateDoc(doc(db, 'users', userCredential.user.uid), { role: 'admin' });
          userData.role = 'admin';
        }

        localStorage.setItem('user', JSON.stringify({
          id: userCredential.user.uid,
          ...userData
        }));
        localStorage.setItem('has_registered', 'true');
        navigate('/admin');
      } catch (err: any) {
        console.error("Admin access error:", err);
        if (err.code === 'auth/operation-not-allowed') {
          setError("Firebase সেটিংস সমস্যা: দয়া করে Firebase Console থেকে Email/Password মেথডটি Enable করুন।");
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          setError("ভুল এডমিন ক্রেডেনশিয়াল। দয়া করে সঠিক তথ্য দিন।");
        } else if (err.code === 'auth/too-many-requests') {
          setError("অনেকবার ভুল চেষ্টা করা হয়েছে। অ্যাকাউন্টটি সাময়িকভাবে লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।");
        } else {
          setError(`এডমিন লগইন করতে সমস্যা হচ্ছে: ${err.message}`);
        }
        setShowErrorDialog(true);
      }
    } else {
      setError('ভুল জিমেইল বা পাসওয়ার্ড!');
      setAdminPassword('');
      setShowAdminDialog(false);
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border border-black/5 dark:border-white/5">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white mb-2 tracking-tighter">
            InnerPower
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-4">{t('sub_title')}</p>
          
          {authText && (
            <div className="flex justify-center">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowAuthTextModal(true)}
                className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
              >
                <FileText size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">দেখুন</span>
              </motion.button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showAuthTextModal && (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-white/10 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
                      <FileText size={20} />
                    </div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                      বইগুলো পড়ে কি শিখবেন?
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAuthTextModal(false)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                    {authText}
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    onClick={() => setShowAuthTextModal(false)}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('username')}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => {
                const val = e.target.value.replace(/\s+/g, '');
                setUsername(val);
                setError('');
                // Reset availability status immediately while typing for a 'live' feel
                if (!isLogin) {
                  setIsUsernameAvailable(null);
                  if (val.length >= 3) {
                    setIsCheckingUsername(true);
                  } else {
                    setIsCheckingUsername(false);
                  }
                }
              }}
              className={`w-full px-4 py-2 rounded-xl border ${
                !isLogin && isUsernameAvailable === false 
                  ? 'border-red-500 ring-1 ring-red-500' 
                  : !isLogin && isUsernameAvailable === true 
                  ? 'border-emerald-500 ring-1 ring-emerald-500' 
                  : 'border-zinc-200 dark:border-zinc-800'
              } bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
            />
            {!isLogin && username.length >= 3 && (
              <div className="mt-1">
                {isCheckingUsername ? (
                  <p className="text-[10px] text-zinc-500 animate-pulse">ইউজারনেম চেক করা হচ্ছে...</p>
                ) : isUsernameAvailable === false ? (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20 space-y-3">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <X size={14} className="shrink-0" />
                      <p className="text-[11px] font-black uppercase tracking-tight">এই ইউজারনেমটি ইতিমধ্যে ব্যবহার করা হয়েছে!</p>
                    </div>
                    
                    {usernameSuggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">নিচের নামগুলো চেষ্টা করতে পারেন:</p>
                        <div className="flex flex-wrap gap-2">
                          {usernameSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setUsername(suggestion);
                                setError('');
                              }}
                              className="text-[10px] font-black bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all shadow-sm active:scale-95"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : isUsernameAvailable === true ? (
                  <p className="text-[10px] text-emerald-500 font-bold">এই ইউজারনেমটি এভেইলেবল আছে!</p>
                ) : null}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('password')}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="রেফার কোড থাকলে দিন"
                className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
          )}

          {error && (
            <div className="space-y-3">
              <div className="bg-red-500 text-white text-xs py-2 px-4 rounded-lg text-center font-bold animate-pulse">
                {error}
              </div>
              {typeof error === 'string' && (error.includes("পাসওয়ার্ডটি ভুল") || error.includes("ভুলে গেছেন")) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    সাপোর্ট নম্বর: {smsSupportNumber || '01990608143'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://wa.me/88${smsSupportNumber || '01990608143'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs text-center hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`imo://chat?phone=88${smsSupportNumber || '01990608143'}`}
                      className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs text-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                    >
                      imo
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowSupportModal(true)}
                      className="w-full py-3 bg-rose-500 text-white rounded-xl font-black text-xs text-center hover:bg-rose-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                    >
                      <MessageSquare size={16} />
                      সাপোর্ট কন্টাক্ট (Live Chat)
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
            {isLogin ? t('login') : t('register')}
          </button>
        </form>

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-emerald-600 hover:text-emerald-700 text-sm font-bold"
            >
              {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
            
            {isLogin && (
              <button
                onClick={() => {
                  setError("পাসওয়ার্ডটি ভুল বা ভুলে গেছেন? নিচে দেওয়া সাপোর্ট বাটনে ক্লিক করে আমাদের সাথে যোগাযোগ করুন।");
                  // Trigger the support UI by setting the error message that contains the specific phrase
                }}
                className="text-zinc-400 hover:text-zinc-500 text-[11px] font-bold uppercase tracking-wider"
              >
                Forgot Password?
              </button>
            )}
          </div>
          
          <div className="flex flex-col items-center gap-2 pt-4 border-t border-zinc-50 dark:border-zinc-800/50">
            <div className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">সাপোর্ট ও যোগাযোগ</div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a 
                href={`https://wa.me/88${smsSupportNumber || '01990608143'}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 hover:scale-105 transition-transform"
              >
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <MessageSquare size={14} />
                </div>
                WhatsApp
              </a>
              <a 
                href={`imo://chat?phone=88${smsSupportNumber || '01990608143'}`} 
                className="flex items-center gap-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:scale-105 transition-transform"
              >
                <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <MessageSquare size={14} />
                </div>
                imo
              </a>
              <button 
                onClick={() => setShowSupportModal(true)}
                className="flex items-center gap-2 text-[11px] font-bold text-rose-600 hover:scale-105 transition-transform"
              >
                <div className="p-1.5 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                  <MessageSquare size={14} />
                </div>
                লাইভ চ্যাট
              </button>
            </div>
          </div>
          
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setShowAdminDialog(true)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold uppercase tracking-widest"
            >
              DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
            </button>
          </div>

      {/* Admin Password Dialog */}
      <AnimatePresence>
        {showAdminDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-white/10"
            >
              <h2 className="text-xl font-black mb-4 tracking-tight">InnerPower Admin</h2>
              <form onSubmit={handleAdminAccess} className="space-y-4">
                <input
                  type="email"
                  placeholder="Gmail"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminDialog(false)}
                    className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg font-bold text-sm"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-bold text-sm"
                  >
                    লগইন
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SupportContactModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        userId={auth.currentUser?.uid || getDeviceId() as any}
        username={username || 'Guest'}
      />
        </div>
      </div>
    );
  };
