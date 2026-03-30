import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from './AppContext';
import { CATEGORIES } from './constants';
import { User, Book, Category } from './types';
import { LogOut, Settings, Shield, BookOpen, User as UserIcon, History, Bell, Send, MessageSquare, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FloatingActions } from './components/FloatingActions';
import { SubscriptionOverlay } from './SubscriptionOverlay';
import { db, auth } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  addDoc,
  orderBy,
  limit
} from 'firebase/firestore';

export const HomePage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lockAllCategories, setLockAllCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('New book');
  const [homeText, setHomeText] = useState('');
  const [homeFontSize, setHomeFontSize] = useState(16);
  const [resumeBook, setResumeBook] = useState<{ id: number, title: string, lastPage: number } | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<Category | null>(null);
  const [categoryPassword, setCategoryPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<number[]>([]);
  const [pendingBook, setPendingBook] = useState<Book | null>(null);
  const [showSubscription, setShowSubscription] = useState(true);
  const { t, language, setLanguage, theme, setTheme } = useApp();
  const navigate = useNavigate();

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
    if (!storedUser) {
      navigate('/auth');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    
    // Verify status with Firestore
    const unsubUser = onSnapshot(doc(db, 'users', parsedUser.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'blocked') {
          localStorage.removeItem('user');
          navigate('/auth', { state: { error: "আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে। দয়া করে অ্যাডমিনের সাথে যোগাযোগ করুন।" } });
          return;
        }
        
        const now = new Date();
        let trialEndsAt = data.trial_ends_at;
        
        // If trial_ends_at is missing, initialize it (3 days from created_at or now)
        if (!trialEndsAt) {
          const createdAt = data.created_at ? safeDate(data.created_at) : now;
          const newTrialEnds = new Date(createdAt);
          newTrialEnds.setDate(newTrialEnds.getDate() + 3);
          trialEndsAt = newTrialEnds.toISOString();
          
          // Update Firestore
          updateDoc(doc(db, 'users', docSnap.id), { trial_ends_at: trialEndsAt }).catch(err => {
            console.error('Error initializing trial_ends_at:', err);
          });
        }

        const trialEnds = safeDate(trialEndsAt);
        const isTrialExpired = now > trialEnds;

        // Calculate days left
        const diffTime = trialEnds.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setTrialDaysLeft(diffDays > 0 ? diffDays : 0);

        const updatedUser = {
          ...parsedUser,
          ...data,
          id: docSnap.id,
          isPaid: !!data.is_paid,
          hasPendingSubscription: !!data.has_pending_subscription,
          isTrialExpired
        };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        localStorage.removeItem('user');
        navigate('/auth');
      }
    }, (err) => {
      console.error('Auth verification failed:', err);
    });

    // Fetch Books
    const unsubBooks = onSnapshot(collection(db, 'books'), (snapshot) => {
      const booksData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(book => !book.is_deleted)
        .sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
      setBooks(booksData);
    }, (err) => console.error('HomePage: Books listener error:', err));

    // Fetch Categories
    const unsubCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const catsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
      setCategories(catsData);
    }, (err) => console.error('HomePage: Categories listener error:', err));

    // Fetch Settings
    const unsubSettings = onSnapshot(collection(db, 'settings'), (snap) => {
      snap.forEach(doc => {
        if (doc.id === 'home_text') setHomeText(doc.data().value || '');
        if (doc.id === 'home_font_size') setHomeFontSize(parseInt(doc.data().value) || 16);
        if (doc.id === 'lock_all_categories') setLockAllCategories(!!doc.data().value);
      });
    }, (err) => console.error('HomePage: Settings listener error:', err));

    // Fetch Notifications
    const qNotif = query(
      collection(db, 'notifications'), 
      where('user_id', 'in', [null, parsedUser.id]),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
      
      const lastSeenId = localStorage.getItem('lastSeenNotificationId') || '';
      const unread = notifs.filter((n: any) => n.id > lastSeenId).length;
      setUnreadCount(unread);
    }, (err) => console.error('HomePage: Notifications listener error:', err));

    // Heartbeat ping to track activity
    const pingInterval = setInterval(() => {
      if (parsedUser.id) {
        updateDoc(doc(db, 'users', parsedUser.id), {
          last_active_at: serverTimestamp()
        }).catch(err => console.error("Ping error:", err));
      }
    }, 30000);

    // Request location
    if (navigator.geolocation && parsedUser.id) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await updateDoc(doc(db, 'users', parsedUser.id), {
              latitude,
              longitude,
              last_active_at: serverTimestamp()
            });
          } catch (error) {
            console.error('Error updating location:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        { enableHighAccuracy: true }
      );
    }

    return () => {
      unsubUser();
      unsubBooks();
      unsubCats();
      unsubSettings();
      unsubNotif();
      clearInterval(pingInterval);
    };
  }, []);

  const handleOpenNotifications = () => {
    setShowNotifications(true);
    if (notifications.length > 0) {
      const maxId = notifications[0].id;
      localStorage.setItem('lastSeenNotificationId', maxId.toString());
      setUnreadCount(0);
    }
  };

  const handleCategoryClick = (cat: Category) => {
    const isLocked = lockAllCategories || cat.is_locked;
    if (isLocked && cat.password && !unlockedCategoryIds.includes(cat.id)) {
      setShowPasswordPrompt(cat);
      setCategoryPassword('');
      setPasswordError(false);
      setPendingBook(null);
      return;
    }
    setSelectedCategory(cat.name);
  };

  const handleVerifyPassword = () => {
    if (showPasswordPrompt && categoryPassword === showPasswordPrompt.password) {
      setUnlockedCategoryIds(prev => [...prev, showPasswordPrompt.id]);
      
      if (pendingBook) {
        const lastPage = localStorage.getItem(`last_page_${pendingBook.id}`);
        setResumeBook({ 
          id: pendingBook.id, 
          title: pendingBook.title, 
          lastPage: lastPage ? parseInt(lastPage) : 1 
        });
        setPendingBook(null);
      } else {
        setSelectedCategory(showPasswordPrompt.name);
      }
      
      setShowPasswordPrompt(null);
      setCategoryPassword('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleSendReply = async (notificationId: string, reply: string) => {
    if (!reply.trim() || !user) return;
    try {
      await addDoc(collection(db, 'notification_replies'), {
        notification_id: notificationId,
        user_id: user.id,
        username: user.fullName || user.username,
        reply,
        created_at: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error sending reply:', error);
    }
    return false;
  };

  const NotificationItem: React.FC<{ notif: any, onReply: (id: string, reply: string) => Promise<boolean> }> = ({ notif, onReply }) => {
    const [replies, setReplies] = useState<any[]>([]);
    const [replyText, setReplyText] = useState('');
    const [showReplies, setShowReplies] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
      if (showReplies) {
        const q = query(
          collection(db, 'notification_replies'), 
          where('notification_id', '==', notif.id),
          orderBy('created_at', 'asc')
        );
        const unsub = onSnapshot(q, (snapshot) => {
          setReplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsub;
      }
    }, [showReplies]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!replyText.trim() || isSending) return;
      setIsSending(true);
      const success = await onReply(notif.id, replyText);
      if (success) {
        setReplyText('');
      }
      setIsSending(false);
    };

    return (
      <div 
        className={`p-4 rounded-2xl border transition-all ${
          notif.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20' :
          notif.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20' :
          notif.type === 'error' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20' :
          'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/20'
        }`}
      >
        <div className="font-black text-sm mb-1">{notif.title}</div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{notif.message}</div>
        <div className="flex items-center justify-between mt-3">
          <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
            {safeDate(notif.created_at).toLocaleString('en-GB')}
          </div>
          <button 
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400"
          >
            <MessageSquare size={12} />
            {showReplies ? 'Hide Replies' : 'Reply'}
          </button>
        </div>

        {showReplies && (
          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-3">
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {replies.map(reply => (
                <div key={reply.id} className="bg-white/50 dark:bg-black/20 p-2 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black text-zinc-500 uppercase">{reply.username}</span>
                    <span className="text-[8px] text-zinc-400">{safeDate(reply.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-tight">{reply.reply}</div>
                </div>
              ))}
              {replies.length === 0 && (
                <div className="text-center py-2 text-[10px] text-zinc-400 font-bold">কোনো উত্তর নেই</div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input 
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="উত্তর লিখুন..."
                className="flex-1 bg-white dark:bg-zinc-800 border-none rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button 
                type="submit"
                disabled={isSending || !replyText.trim()}
                className="p-2 bg-indigo-600 text-white rounded-xl disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/auth');
  };

  if (!user) return null;

  const isTrialExpired = user.trialEndsAt ? safeDate(user.trialEndsAt) < new Date() : user.isTrialExpired;
  const isRestricted = (isTrialExpired && !user.isPaid);

  const handleBookClick = (book: Book) => {
    if (isRestricted) {
      localStorage.removeItem('user');
      navigate('/auth');
      return;
    }

    // Check if book belongs to any locked category
    const bookCategories = book.category ? book.category.split(', ') : [];
    for (const catName of bookCategories) {
      const cat = categories.find(c => c.name === catName);
      if (cat) {
        const isLocked = lockAllCategories || cat.is_locked;
        if (isLocked && cat.password && !unlockedCategoryIds.includes(cat.id)) {
          setShowPasswordPrompt(cat);
          setCategoryPassword('');
          setPasswordError(false);
          setPendingBook(book);
          return;
        }
      }
    }
    
    const lastPage = localStorage.getItem(`last_page_${book.id}`);
    setResumeBook({ 
      id: book.id, 
      title: book.title, 
      lastPage: lastPage ? parseInt(lastPage) : 1 
    });
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (book.description && book.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Support multi-category filtering (e.g., "New book, Love Story")
    const bookCategories = book.category ? book.category.split(', ') : [];
    const matchesCategory = selectedCategory === 'All' || 
                           bookCategories.includes(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Resume Reading Dialog */}
      <AnimatePresence>
        {resumeBook && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-white/10 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                  পড়া শুরু করুন
                </h2>
                <button 
                  onClick={() => setResumeBook(null)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
                >
                  <Settings size={20} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => {
                    navigate(`/book/${resumeBook.id}?page=1`);
                    setResumeBook(null);
                  }}
                  className="w-full group relative overflow-hidden py-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-black uppercase tracking-widest transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center gap-3"
                >
                  <BookOpen size={20} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                  প্রথম থেকে পড়ুন
                </button>

                <button
                  onClick={() => {
                    navigate(`/book/${resumeBook.id}?page=${resumeBook.lastPage}`);
                    setResumeBook(null);
                  }}
                  className="w-full group relative overflow-hidden py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center"
                >
                  <div className="flex items-center gap-3">
                    <History size={20} />
                    যেখান থেকে শেষ করেছিলেন
                  </div>
                  {resumeBook.lastPage > 1 && (
                    <span className="text-[10px] opacity-80 mt-1 font-bold">
                      (পৃষ্ঠা নম্বর: {resumeBook.lastPage})
                    </span>
                  )}
                </button>
              </div>

              <p className="mt-6 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                InnerPower Library System
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Publish Info Modal */}
      <AnimatePresence>
        {showPublishModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-white/10 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                  আপনার সৃজনশীলতা প্রকাশ করুন
                </h2>
                <button 
                  onClick={() => setShowPublishModal(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
                >
                  <Settings size={20} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                  আপনার লেখা বই, ছোটগল্প কিংবা জীবনের বিশেষ কোনো স্মৃতি কি সবার সাথে শেয়ার করতে চান? আমাদের অ্যাপে আপনার কন্টেন্ট প্রকাশ করতে এখনই আমাদের সাথে যোগাযোগ করুন।
                </p>
                
                <a
                  href="https://wa.me/8801613071344"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <UserIcon size={20} />
                  WhatsApp-এ যোগাযোগ করুন
                </a>
              </div>

              <p className="mt-6 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                01990608143 (WhatsApp Only)
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trial Banner */}
      {!user?.isPaid && trialDaysLeft !== null && (
        <div className={`py-2 text-center font-bold text-sm transition-colors ${trialDaysLeft <= 1 ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {trialDaysLeft > 0 
            ? `আপনার ট্রায়াল এর মিয়াদ আরও ${trialDaysLeft} দিন বাকি আছে` 
            : 'আপনার ট্রায়াল এর মিয়াদ শেষ হয়েছে'}
        </div>
      )}

      {/* Subscription Overlay */}
    {user && user.isTrialExpired && !user.isPaid && user.role !== 'admin' && showSubscription && (
      <SubscriptionOverlay user={user} onClose={() => {
        localStorage.removeItem('user');
        navigate('/auth');
      }} />
    )}

    {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-black/5 dark:border-white/5 sticky top-0 z-50">
        <div className="w-full bg-white dark:bg-zinc-900 pt-10 pb-3 px-4 flex flex-col gap-6">
          <div className="flex justify-between items-start w-full">
            <div className="flex flex-col items-start">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">InnerPower</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">বই লাইব্রেরী - বইগুলো পড়ে কি শিখবেন?</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 uppercase tracking-widest font-bold">
                DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/profile')}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400"
                >
                  <UserIcon size={20} />
                </button>
                <button 
                  onClick={handleOpenNotifications}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 relative"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {user.role === 'admin' && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-emerald-600"
                  >
                    <Shield size={20} />
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-red-500"
                >
                  <LogOut size={20} />
                </button>
              </div>
              
              <button
                onClick={() => setShowPublishModal(true)}
                className="px-4 py-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                নিজের তথ্য প্রকাশ করুন
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="বই বা লেখকের নাম দিয়ে খুঁজুন..."
              className="w-full p-4 pl-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-black/5 dark:border-white/5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
            />
            <Settings className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                selectedCategory === 'All' 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              সব বই
            </button>
            {categories.map(cat => {
              const isLocked = (lockAllCategories || cat.is_locked) && !unlockedCategoryIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                    selectedCategory === cat.name 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                    : isLocked
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat.name === 'New book' ? 'নতুন বই' : cat.name}
                  {isLocked && <Lock size={10} />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Floating Action Buttons */}
      <FloatingActions />

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 w-full max-w-md shadow-2xl border border-white/10 flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                    <Bell size={20} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight">নোটিফিকেশন</h2>
                </div>
                <button 
                  onClick={() => setShowNotifications(false)} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <LogOut size={20} className="rotate-180" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {notifications.map(notif => (
                  <NotificationItem key={notif.id} notif={notif} onReply={handleSendReply} />
                ))}
                {notifications.length === 0 && (
                  <div className="py-12 text-center text-zinc-400 text-sm font-bold">কোনো নোটিফিকেশন নেই</div>
                )}
              </div>

              <button 
                onClick={() => setShowNotifications(false)}
                className="mt-6 w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                বন্ধ করুন
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Book List */}
        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredBooks.map((book) => (
              <motion.div
                key={book.id}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group cursor-pointer"
                onClick={() => handleBookClick(book)}
              >
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg group-hover:shadow-2xl transition-all border border-black/5 dark:border-white/5">
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isRestricted ? 'grayscale blur-[3px]' : ''}`}
                    referrerPolicy="no-referrer"
                  />
                  {isRestricted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                      <Shield className="text-white" size={40} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <h3 className="mt-4 font-bold text-sm line-clamp-1 group-hover:text-emerald-600 transition-colors leading-snug">
                  {book.title}
                </h3>
                {book.author && (
                  <p className="text-[10px] text-zinc-500 font-bold mt-0.5 line-clamp-1">
                    {book.author}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="text-zinc-400 font-bold text-lg">দুঃখিত, কোনো বই পাওয়া যায়নি!</div>
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="py-16 text-center opacity-40 text-[10px] font-black tracking-[0.3em] uppercase">
        DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
      </footer>
      {/* Password Prompt Modal */}
      <AnimatePresence>
        {showPasswordPrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordPrompt(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-2xl border border-black/5 dark:border-white/5"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto text-red-600">
                  <Lock size={32} />
                </div>
                <h3 className="text-xl font-black tracking-tight">পাসওয়ার্ড প্রয়োজন</h3>
                <p className="text-zinc-500 text-sm font-medium">"{showPasswordPrompt.name}" ক্যাটাগরিটি লক করা আছে। এটি দেখতে পাসওয়ার্ড দিন।</p>
                
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="পাসওয়ার্ড লিখুন..."
                    value={categoryPassword}
                    onChange={(e) => {
                      setCategoryPassword(e.target.value);
                      setPasswordError(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-2 outline-none transition-all text-center font-bold tracking-widest ${
                      passwordError ? 'border-red-500' : 'border-transparent focus:border-emerald-500'
                    }`}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                  />
                  {passwordError && (
                    <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowPasswordPrompt(null)}
                    className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-black uppercase tracking-widest text-[10px]"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleVerifyPassword}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20"
                  >
                    প্রবেশ করুন
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
