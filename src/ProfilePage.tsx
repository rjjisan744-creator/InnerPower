import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, 
  Mail, 
  BookOpen, 
  History, 
  Heart, 
  Settings, 
  LogOut, 
  ChevronRight, 
  ArrowLeft,
  Edit3,
  Camera,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Share2,
  Copy,
  Users,
  Loader2,
  Check,
  Plus,
  Trash,
  ChevronLeft,
  MoreVertical,
  FileText,
  MessageSquare,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Note, Book } from './types';
import { SubscriptionOverlay } from './SubscriptionOverlay';
import { SupportContactModal } from './components/SupportContactModal';

// Toast Component for Senior UX
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 50, x: '-50%' }}
      className={`fixed bottom-8 left-1/2 z-[200] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border ${
        type === 'success' 
          ? 'bg-emerald-500 text-white border-emerald-400' 
          : 'bg-red-500 text-white border-red-400'
      }`}
    >
      {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      <span className="font-bold text-sm">{message}</span>
    </motion.div>
  );
};

import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [referralHistory, setReferralHistory] = useState<any[]>([]);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [wishlistBooks, setWishlistBooks] = useState<Book[]>([]);
  const [historyBooks, setHistoryBooks] = useState<Book[]>([]);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [showSubscription, setShowSubscription] = useState(true);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setEditForm({
        fullName: parsedUser.fullName || '',
        email: parsedUser.email || ''
      });

      // Fetch fresh data for stats
      const unsub = onSnapshot(doc(db, "users", parsedUser.id), (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          if (userData.status === 'blocked') {
            localStorage.removeItem('user');
            navigate('/auth', { state: { error: 'Your account has been blocked.' } });
            return;
          }
          const updatedUser = {
            ...parsedUser,
            ...userData,
            id: docSnap.id,
            fullName: userData.full_name || parsedUser.fullName,
            profilePicture: userData.profile_picture || parsedUser.profilePicture,
            referralCode: userData.referral_code || parsedUser.referralCode,
            referralCount: userData.referral_count || 0,
            isPaid: !!userData.is_paid,
            trialEndsAt: userData.trial_ends_at,
            isTrialExpired: userData.trial_ends_at ? safeDate(userData.trial_ends_at) < new Date() : false
          };

          // If referral code is missing in Firestore, generate one
          if (!userData.referral_code) {
            const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            updateDoc(doc(db, "users", docSnap.id), {
              referral_code: newReferralCode
            }).catch(err => console.error("Error generating referral code:", err));
            updatedUser.referralCode = newReferralCode;
          }

          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } else {
          localStorage.removeItem('user');
          navigate('/auth');
        }
      });
      return () => unsub();
    } else {
      navigate('/auth');
    }
  }, [navigate]);

  // Fetch all notes
  useEffect(() => {
    if (user) {
      const q = query(collection(db, "user_notes"), where("user_id", "==", user.id), orderBy("updated_at", "desc"));
      const unsub = onSnapshot(q, (snap) => {
        setNotesList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      });
      return () => unsub();
    }
  }, [user?.id]);

  // Debounced Auto-save for selected note
  useEffect(() => {
    if (selectedNote) {
      const timer = setTimeout(() => {
        handleAutoSaveNote();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedNote?.title, selectedNote?.content]);

  const handleCreateNote = async () => {
    if (!user) return;
    try {
      const newNoteData = {
        user_id: user.id,
        title: 'New Note',
        content: '',
        updated_at: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, "user_notes"), newNoteData);
      const newNote = { id: docRef.id, ...newNoteData, updated_at: new Date().toISOString() };
      setSelectedNote(newNote as any);
    } catch (error) {
      showToast('Failed to create note', 'error');
    }
  };

  const handleAutoSaveNote = async () => {
    if (!selectedNote) return;
    setSaveStatus('saving');
    try {
      await updateDoc(doc(db, "user_notes", String(selectedNote.id)), {
        title: selectedNote.title,
        content: selectedNote.content,
        updated_at: serverTimestamp()
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, "user_notes", id));
      if (selectedNote?.id === id) setSelectedNote(null);
      showToast('Note deleted');
    } catch (error) {
      showToast('Failed to delete note', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleLogout = () => {
    auth.signOut().then(() => {
      localStorage.removeItem('user');
      navigate('/auth');
    }).catch(err => {
      console.error("Logout error:", err);
      localStorage.removeItem('user');
      navigate('/auth');
    });
  };

  const fetchReferralHistory = async () => {
    if (!user) return;
    setLoadingReferrals(true);
    try {
      const q = query(collection(db, "referrals"), where("referrer_id", "==", user.id), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      
      const history = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        // Use saved usernames if available, otherwise fetch
        if (data.referee_username) {
          return {
            id: d.id,
            ...data,
            referee_name: data.referee_username,
            referee_status: 'active'
          };
        }
        
        try {
          const refereeDoc = await getDoc(doc(db, "users", data.referee_id));
          const refereeData = refereeDoc.exists() ? refereeDoc.data() : { username: 'Unknown', status: 'pending' };
          return {
            id: d.id,
            ...data,
            referee_name: refereeData.username,
            referee_status: refereeData.status
          };
        } catch (err) {
          return {
            id: d.id,
            ...data,
            referee_name: 'Unknown',
            referee_status: 'pending'
          };
        }
      }));
      
      setReferralHistory(history);
      setShowReferralModal(true);
    } catch (error) {
      console.error('Error fetching referral history:', error);
      showToast('রেফারেল হিস্টোরি লোড করতে সমস্যা হয়েছে', 'error');
    } finally {
      setLoadingReferrals(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // Local Storage Helper: Save User Data
  const saveToLocalStorage = (updatedData: Partial<User>) => {
    if (!user) return;
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 500 * 1024) {
      showToast('Image size must be less than 500KB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setLoading(true);
      
      try {
        await updateDoc(doc(db, "users", user.id), { profile_picture: base64String });
        saveToLocalStorage({ profilePicture: base64String });
        showToast('Profile picture updated!');
      } catch (error) {
        console.warn('Sync failed');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.id), { 
        full_name: editForm.fullName,
        email: editForm.email
      });
      saveToLocalStorage({ 
        fullName: editForm.fullName,
        email: editForm.email
      });
      setIsEditing(false);
      showToast('Profile updated successfully!');
    } catch (error) {
      console.warn('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (label: string) => {
    if (label === "Edit Profile") {
      setIsEditing(true);
    } else if (label === "My Wishlist") {
      fetchWishlist();
    } else if (label === "Reading History") {
      fetchHistory();
    } else if (label === "Live Support") {
      setShowSupportModal(true);
    } else if (label === "Refer & Earn") {
      // Handled by the new section
    } else {
      setShowComingSoon(label);
    }
  };

  const fetchWishlist = async () => {
    if (!user) return;
    setShowWishlist(true);
    setLoadingList(true);
    try {
      const q = query(collection(db, "wishlist"), where("user_id", "==", user.id));
      const snap = await getDocs(q);
      const bookIds = snap.docs.map(doc => doc.data().book_id);
      
      if (bookIds.length === 0) {
        setWishlistBooks([]);
      } else {
        // Fetch only needed books to be more efficient
        const booksSnap = await getDocs(collection(db, "books"));
        const allBooks = booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Book));
        setWishlistBooks(allBooks.filter(b => bookIds.includes(b.id)));
      }
    } catch (e) {
      console.error('Wishlist error:', e);
      showToast('Failed to load wishlist', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    setShowHistory(true);
    setLoadingList(true);
    try {
      // Remove orderBy to avoid index requirement if not created yet
      const q = query(collection(db, "reading_history"), where("user_id", "==", user.id));
      const snap = await getDocs(q);
      const historyData = snap.docs.map(doc => doc.data());
      
      // Sort manually in memory
      historyData.sort((a, b) => {
        const dateA = a.read_at ? new Date(a.read_at).getTime() : 0;
        const dateB = b.read_at ? new Date(b.read_at).getTime() : 0;
        return dateB - dateA;
      });

      const bookIds = historyData.map(h => h.book_id);

      if (bookIds.length === 0) {
        setHistoryBooks([]);
      } else {
        const booksSnap = await getDocs(collection(db, "books"));
        const allBooks = booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Book));
        const historyList = historyData.map(h => {
          const book = allBooks.find(b => b.id === h.book_id);
          return book ? { ...book, read_at: h.read_at } : null;
        }).filter(Boolean) as Book[];
        setHistoryBooks(historyList);
      }
    } catch (e) {
      console.error('History error:', e);
      showToast('Failed to load history', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('রেফার কোড কপি করা হয়েছে!');
  };

  const shareReferral = () => {
    if (navigator.share) {
      navigator.share({
        title: 'InnerPower App',
        text: `আমার রেফার কোড ${user?.referralCode} ব্যবহার করে InnerPower অ্যাপে জয়েন করুন এবং ৩ দিনের জায়গায় ৬ দিন Free ট্রায়াল পান!`,
        url: window.location.origin,
      }).catch(console.error);
    } else {
      copyToClipboard(user?.referralCode || '');
    }
  };

  if (!user) return null;

  const profileData = {
    fullName: user.fullName || user.username,
    email: user.email || "No email set",
    profilePicture: user.profilePicture || user.profile_picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
    booksReadCount: user.booksReadCount || 0,
    currentlyReading: user.currentlyReading || "None",
    trialDaysLeft: (() => {
      if (!user.trialEndsAt) return 0;
      const endsAt = safeDate(user.trialEndsAt);
      const now = new Date();
      const diffTime = endsAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    })()
  };

  const menuItems = [
    { icon: <Edit3 size={20} />, label: "Edit Profile", color: "text-blue-500" },
    { icon: <Heart size={20} />, label: "My Wishlist", color: "text-pink-500" },
    { icon: <History size={20} />, label: "Reading History", color: "text-emerald-500" },
    { icon: <MessageSquare size={20} />, label: "Live Support", color: "text-rose-500" },
    { icon: <Settings size={20} />, label: "App Settings", color: "text-zinc-500" },
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Subscription Overlay */}
      {user && user.isTrialExpired && !user.isPaid && showSubscription && (
        <SubscriptionOverlay 
          user={user} 
          onClose={() => setShowSubscription(false)}
        />
      )}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-black/5 dark:border-white/5 sticky top-0 z-50 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-black tracking-tight">User Profile</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Trial Banner */}
      {!user?.isPaid && profileData.trialDaysLeft !== null && (
        <div className={`py-2 text-center font-bold text-sm transition-colors ${profileData.trialDaysLeft <= 1 ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {profileData.trialDaysLeft > 0 
            ? `আপনার Free ট্রায়াল এর মিয়াদ আরও ${profileData.trialDaysLeft} দিন বাকি আছে` 
            : 'আপনার ট্রায়াল এর মিয়াদ শেষ হয়েছে'}
        </div>
      )}

      <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
        {/* Profile Update Instruction */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
        >
          <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20">
            <Edit3 size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-100 tracking-tight">নিজের প্রোফাইল আপডেট করুন</h4>
            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">আপনার তথ্যগুলো সঠিক রাখুন এবং প্রোফাইলটি সাজিয়ে নিন।</p>
          </div>
          <button 
            onClick={() => setIsEditing(true)}
            className="ml-auto px-4 py-2 bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            এডিট করুন
          </button>
        </motion.div>

        {/* Profile Header Card */}
        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-xl border border-black/5 dark:border-white/5 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
          
          <div className="relative inline-block mb-6">
            <div className="w-32 h-32 rounded-full border-4 border-white dark:border-zinc-800 shadow-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              <img 
                src={profileData.profilePicture} 
                alt="Profile" 
                className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}
                referrerPolicy="no-referrer"
              />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <button 
              onClick={handleImageClick}
              disabled={loading}
              className="absolute bottom-0 right-0 p-2 bg-emerald-500 text-white rounded-full shadow-lg border-2 border-white dark:border-zinc-900 hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
            >
              <Camera size={16} />
            </button>
          </div>

          <h2 className="text-2xl font-black tracking-tight mb-1">{profileData.fullName}</h2>
          <div className="flex items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
            <Mail size={14} />
            <span className="text-sm">{profileData.email}</span>
          </div>
        </section>

        {/* Edit Profile Modal */}
        <AnimatePresence>
          {isEditing && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-white/10"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black tracking-tight">Edit Profile</h2>
                  <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 mb-2 uppercase tracking-[0.2em]">Username (Login ID)</label>
                    <div className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold cursor-not-allowed flex items-center justify-between">
                      <span>{user?.username}</span>
                      <Shield size={14} className="opacity-50" />
                    </div>
                    <p className="mt-2 text-[9px] font-medium text-zinc-400 italic">* ইউজারনেম পরিবর্তন করা সম্ভব নয় কারণ এটি লগইন করার জন্য প্রয়োজন।</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 mb-2 uppercase tracking-[0.2em]">Full Name (Display Name)</label>
                    <input 
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                      className="w-full p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-emerald-500/50 outline-none transition-all font-bold"
                      placeholder="আপনার পুরো নাম লিখুন"
                    />
                    <p className="mt-2 text-[9px] font-medium text-zinc-400 italic">* এটি শুধুমাত্র আপনার প্রোফাইলে দেখানোর জন্য ব্যবহার করা হবে।</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 mb-2 uppercase tracking-[0.2em]">Email Address</label>
                    <input 
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="w-full p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-emerald-500/50 outline-none transition-all font-bold"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Save size={20} />
                    )}
                    {loading ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Coming Soon Modal */}
        <AnimatePresence>
          {showComingSoon && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl border border-white/10 text-center"
              >
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Clock size={40} />
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-2">{showComingSoon}</h2>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">
                  This feature is currently under development. Stay tuned for updates!
                </p>
                <button 
                  onClick={() => setShowComingSoon(null)}
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Got it!
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Wishlist & History Modals */}
        <AnimatePresence>
          {(showWishlist || showHistory) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-white/10 flex flex-col max-h-[80vh]"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black tracking-tight">
                    {showWishlist ? "My Wishlist" : "Reading History"}
                  </h2>
                  <button 
                    onClick={() => { setShowWishlist(false); setShowHistory(false); }}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                  {loadingList ? (
                    <div className="py-12 text-center">
                      <div className="animate-spin w-10 h-10 border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-white rounded-full mx-auto mb-4" />
                      <p className="text-zinc-400 font-bold text-sm">লোড হচ্ছে...</p>
                    </div>
                  ) : (showWishlist ? wishlistBooks : historyBooks).length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="text-zinc-300" size={32} />
                      </div>
                      <p className="text-zinc-400 font-bold text-sm">
                        {showWishlist ? "আপনার উইশলিস্ট খালি" : "আপনার রিডিং হিস্টোরি খালি"}
                      </p>
                    </div>
                  ) : (
                    (showWishlist ? wishlistBooks : historyBooks).map((book) => (
                      <button 
                        key={book.id}
                        onClick={() => navigate(`/book-info/${book.id}`)}
                        className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left group"
                      >
                        <div className="w-16 h-20 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                          <img 
                            src={book.cover_url} 
                            alt={book.title} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-zinc-900 dark:text-white truncate">{book.title}</h4>
                          <p className="text-xs text-zinc-400 font-bold truncate">{book.author}</p>
                          {showHistory && (book as any).read_at && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                              <Clock size={10} />
                              {safeDate((book as any).read_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={18} className="text-zinc-200 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          {!user.isPaid && (
            <motion.div 
              whileHover={{ y: -5 }}
              className={`p-6 rounded-3xl shadow-lg border ${profileData.trialDaysLeft <= 1 ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20' : 'bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-xl ${profileData.trialDaysLeft <= 1 ? 'bg-red-100 text-red-600' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'}`}>
                  <Clock size={20} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Trial Left</span>
              </div>
              <div className={`text-3xl font-black ${profileData.trialDaysLeft <= 1 ? 'text-red-600' : ''}`}>{profileData.trialDaysLeft} Days</div>
            </motion.div>
          )}

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-lg border border-black/5 dark:border-white/5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                <History size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Books Read</span>
            </div>
            <div className="text-3xl font-black">{profileData.booksReadCount}</div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-lg border border-black/5 dark:border-white/5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                <BookOpen size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Reading Now</span>
            </div>
            <div className="text-sm font-black line-clamp-1">{profileData.currentlyReading}</div>
          </motion.div>
        </div>

        {/* Referral Section */}
        <section className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2.5rem] p-8 shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-xl">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-black tracking-tight">Refer & Earn</h3>
            </div>
            <p className="text-emerald-50 font-medium text-sm mb-6 leading-relaxed">
              আপনার বন্ধুদের রেফার করুন এবং প্রতি সফল রেফারে ৩ দিন অতিরিক্ত Free ট্রায়াল পান! (সর্বোচ্চ ১০ জন)
            </p>
            
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/20 mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100 block mb-1">Your Referral Code</span>
                <span className="text-2xl font-black tracking-wider">{user.referralCode}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => copyToClipboard(user.referralCode || '')}
                  className="p-3 bg-white text-emerald-600 rounded-xl hover:scale-110 transition-transform shadow-lg"
                >
                  <Copy size={20} />
                </button>
                <button 
                  onClick={shareReferral}
                  className="p-3 bg-emerald-400 text-white rounded-xl hover:scale-110 transition-transform shadow-lg"
                >
                  <Share2 size={20} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <div className="flex items-center justify-between text-sm font-bold bg-black/10 rounded-xl px-4 py-2">
                <span>Total Referrals:</span>
                <span className="bg-white text-emerald-600 px-3 py-1 rounded-lg">{user.referralCount || 0} / 10</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold bg-black/10 rounded-xl px-4 py-2">
                <span>Bonus Days Earned:</span>
                <span className="bg-white text-emerald-600 px-3 py-1 rounded-lg">{(user.referralStats?.granted_count || 0) * 3} Days</span>
              </div>
              {user.referralStats && user.referralStats.pending_count > 0 && (
                <div className="flex items-center justify-between text-sm font-bold bg-amber-500/20 rounded-xl px-4 py-2 border border-amber-500/30">
                  <span className="text-amber-100 italic">Pending Referrals:</span>
                  <span className="bg-amber-500 text-white px-3 py-1 rounded-lg">{user.referralStats.pending_count}</span>
                </div>
              )}
              {user.referralStats && user.referralStats.pending_count > 0 && (
                <p className="text-[10px] text-emerald-100 italic text-center mt-1">
                  * আইডি একটিভ করলে আপনি বোনাস পেয়ে যাবেন
                </p>
              )}
              <button 
                onClick={fetchReferralHistory}
                disabled={loadingReferrals}
                className="mt-2 w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                {loadingReferrals ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <History size={14} />
                )}
                Referral History
              </button>
            </div>
          </div>
        </section>

        {/* Referral History Modal */}
        <AnimatePresence>
          {showReferralModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowReferralModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                      <Users size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Referral History</h3>
                  </div>
                  <button 
                    onClick={() => setShowReferralModal(false)}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/50 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {referralHistory.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
                        <Users size={32} />
                      </div>
                      <p className="text-white/40 text-sm">এখনো কোনো রেফারেল নেই</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {referralHistory.map((ref) => (
                        <div 
                          key={ref.id}
                          className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-white font-bold text-sm">{ref.referee_name}</span>
                            <span className="text-[10px] text-white/40">
                              {safeDate(ref.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              ref.referee_status === 'active' 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {ref.referee_status}
                            </span>
                            <span className={`text-[10px] font-bold ${
                              ref.bonus_granted 
                                ? 'text-emerald-400' 
                                : 'text-white/20'
                            }`}>
                              {ref.bonus_granted ? '+3 Days Bonus' : 'Bonus Pending'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="p-6 bg-white/5 border-t border-white/10">
                  <p className="text-[10px] text-white/40 text-center italic">
                    * রেফারেল আইডি একটিভ করলে আপনি ৩ দিন বোনাস পাবেন
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Notepad App Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-xl border border-black/5 dark:border-white/5 overflow-hidden">
          <div className="p-8 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-amber-50/30 dark:bg-amber-900/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                <Edit3 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">My Notes</h3>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {notesList.length} {notesList.length === 1 ? 'Note' : 'Notes'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleCreateNote}
              className="p-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="min-h-[300px] max-h-[500px] overflow-y-auto">
            <AnimatePresence mode="wait">
              {selectedNote ? (
                <motion.div 
                  key="editor"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <button 
                      onClick={() => setSelectedNote(null)}
                      className="flex items-center gap-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-bold text-sm transition-colors"
                    >
                      <ChevronLeft size={18} />
                      Back
                    </button>
                    <div className="flex items-center gap-3">
                      <AnimatePresence mode="wait">
                        {saveStatus === 'saving' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Saving...</motion.div>
                        )}
                        {saveStatus === 'saved' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Saved</motion.div>
                        )}
                      </AnimatePresence>
                      <button 
                        onClick={() => handleDeleteNote(selectedNote.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </div>

                  <input 
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => setSelectedNote({...selectedNote, title: e.target.value})}
                    placeholder="Note Title"
                    className="w-full text-2xl font-black bg-transparent border-none outline-none mb-4 placeholder:text-zinc-200 dark:placeholder:text-zinc-800"
                  />
                  
                  <textarea 
                    value={selectedNote.content}
                    onChange={(e) => setSelectedNote({...selectedNote, content: e.target.value})}
                    placeholder="Start writing..."
                    className="w-full h-[300px] bg-transparent border-none outline-none resize-none font-medium leading-relaxed text-zinc-600 dark:text-zinc-400 placeholder:text-zinc-200 dark:placeholder:text-zinc-800"
                  />
                </motion.div>
              ) : (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="divide-y divide-black/5 dark:divide-white/5"
                >
                  {notesList.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="text-zinc-300" size={32} />
                      </div>
                      <p className="text-zinc-400 font-bold text-sm">No notes yet. Create your first one!</p>
                    </div>
                  ) : (
                    notesList.map((note) => (
                      <button 
                        key={note.id}
                        onClick={() => setSelectedNote(note)}
                        className="w-full p-6 flex items-start gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left group"
                      >
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-zinc-900 dark:text-white truncate mb-1">{note.title}</h4>
                          <p className="text-xs text-zinc-400 font-medium truncate mb-2">{note.content || 'No content'}</p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">
                            <Clock size={10} />
                            {safeDate(note.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-zinc-200 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Menu Options */}
        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-xl border border-black/5 dark:border-white/5">
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {menuItems.map((item, index) => (
              <button 
                key={index}
                onClick={() => handleMenuClick(item.label)}
                className="w-full p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 ${item.color} group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <span className="font-bold text-lg">{item.label}</span>
                </div>
                <ChevronRight size={20} className="text-zinc-300 group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
            
            <button 
              onClick={handleLogout}
              className="w-full p-6 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 group-hover:scale-110 transition-transform">
                  <LogOut size={20} />
                </div>
                <span className="font-bold text-lg text-red-600">Logout</span>
              </div>
              <ChevronRight size={20} className="text-red-300 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* Footer Branding */}
        <footer className="py-8 text-center opacity-30 text-[8px] font-black tracking-[0.3em] uppercase">
          DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
        </footer>
      </main>

      <SupportContactModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        userId={user.id}
        username={user.username}
        fullName={user.fullName}
      />
    </div>
  );
};
