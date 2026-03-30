import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from './AppContext';
import { CATEGORIES } from './constants';
import { User, Book, Category, Note } from './types';
import { Users, PlusCircle, ArrowLeft, Image as ImageIcon, BookOpen, FileText, Save, Search, Edit2, Trash2, X, Copy, Check, ChevronDown, ChevronUp, Trash, FileEdit, User as UserIcon, ArrowUpNarrowWide, Mail, Settings, History, File, MapPin, Bell, Send, MessageSquare, List, Lock, Unlock, Edit3, AlertCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, addDoc, serverTimestamp, onSnapshot, runTransaction, writeBatch } from 'firebase/firestore';

export const AdminPanelPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [deletedBooks, setDeletedBooks] = useState<Book[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<{user_id: number | string, username: string} | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [lockAllCategories, setLockAllCategories] = useState(false);
  const [activeTab, setActiveTab] = useState<'books' | 'users' | 'recycle' | 'settings' | 'referrals' | 'notifications' | 'categories' | 'subscriptions' | 'support'>('books');
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'pending' | 'blocked' | 'active' | 'online' | 'offline' | 'expired'>('all');
  const [bookSearch, setBookSearch] = useState('');
  const [recycleSearch, setRecycleSearch] = useState('');
  const [referralSearch, setReferralSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userNotes, setUserNotes] = useState<Note[]>([]);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const { t } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings State
  const [homeText, setHomeText] = useState('');
  const [homeFontSize, setHomeFontSize] = useState(16);
  const [authText, setAuthText] = useState('');
  const [smsSupportNumber, setSmsSupportNumber] = useState('');
  const [bkashNumber, setBkashNumber] = useState('');
  const [subscriptionAmount, setSubscriptionAmount] = useState(100);

  // Book Form State
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [category, setCategory] = useState('New book');
  const [description, setDescription] = useState('');
  const [pages, setPages] = useState<string[]>(['']);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<number | null>(null);
  const [editingOrderBookId, setEditingOrderBookId] = useState<number | null>(null);
  const [newOrderIndex, setNewOrderIndex] = useState<number>(0);
  const [newPassword, setNewPassword] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [userDeleteConfirmId, setUserDeleteConfirmId] = useState<number | null>(null);
  const [permDeleteConfirmId, setPermDeleteConfirmId] = useState<number | null>(null);
  const [restoreConfirmId, setRestoreConfirmId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTrialUserId, setEditingTrialUserId] = useState<number | null>(null);
  const [newTrialDate, setNewTrialDate] = useState('');

  // Category Form State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryPassword, setEditCategoryPassword] = useState('');
  const [editCategorySortIndex, setEditCategorySortIndex] = useState<number>(0);

  // Notification Form State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState('info');
  const [notifUserId, setNotifUserId] = useState<number | null>(null);
  const [isSendingNotif, setIsSendingNotif] = useState(false);

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

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-unlock loading after 3 seconds to prevent stuck spinners
    const timer = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) {
          console.warn("AdminPanel: Auto-unlocking loading state after 3s");
          return false;
        }
        return prev;
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log("AdminPanel: Initializing...");
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      console.warn("AdminPanel: No user in localStorage, redirecting...");
      navigate('/');
      return;
    }

    let user;
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error("AdminPanel: Failed to parse user", e);
      navigate('/');
      return;
    }

    if (user.role !== 'admin') {
      console.warn("AdminPanel: User is not admin, redirecting...", user.role);
      setLoadError("আপনি অ্যাডমিন নন! এই পেজটি শুধুমাত্র অ্যাডমিনদের জন্য।");
      setIsLoading(false);
      setTimeout(() => navigate('/'), 3000);
      return;
    }
    
    console.log("AdminPanel: User is admin, starting listeners...");
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) {
          console.warn("AdminPanel: Loading timeout reached, forcing finish");
          return false;
        }
        return prev;
      });
    }, 5000);

    // Real-time listeners
    console.log("AdminPanel: Setting up users listener...");
    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("created_at", "desc"), limit(50)), (snap) => {
      console.log("AdminPanel: Users snapshot received, size:", snap.size);
      const data = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          isPaid: d.is_paid || false,
          hasPendingSubscription: d.has_pending_subscription || false,
          trialEndsAt: d.trial_ends_at || '',
          referralCode: d.referral_code,
          referredBy: d.referred_by,
          referralCount: d.referral_count,
        } as unknown as User;
      });
      setUsers(data.filter(u => u.role !== 'admin'));
      setIsLoading(false);
      clearTimeout(timeoutId);
    }, (err) => {
      console.error('AdminPanel: Users listener error:', err);
      setLoadError(`Users Listener Error: ${err.message}`);
      setIsLoading(false);
      clearTimeout(timeoutId);
    });

    console.log("AdminPanel: Setting up books listener...");
    const unsubBooks = onSnapshot(query(collection(db, "books"), where("is_deleted", "==", false), orderBy("sort_index", "asc")), (snap) => {
      console.log("AdminPanel: Books snapshot received, size:", snap.size);
      setBooks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Book)));
      setIsLoading(false);
    }, (err) => {
      console.error('AdminPanel: Books listener error:', err);
      setLoadError(`Books Error: ${err.message}`);
      setIsLoading(false);
    });

    console.log("AdminPanel: Setting up deleted books listener...");
    const unsubDeletedBooks = onSnapshot(query(collection(db, "books"), where("is_deleted", "==", true)), (snap) => {
      console.log("AdminPanel: DeletedBooks snapshot received, size:", snap.size);
      setDeletedBooks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Book)));
      setIsLoading(false);
    }, (err) => {
      console.error('AdminPanel: DeletedBooks listener error:', err);
      setLoadError(`Deleted Books Error: ${err.message}`);
      setIsLoading(false);
    });

    const unsubCategories = onSnapshot(query(collection(db, "categories"), orderBy("sort_index", "asc")), (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Category)));
      setIsLoading(false);
    }, (err) => {
      console.error('AdminPanel: Categories listener error:', err);
      setLoadError(`Categories Error: ${err.message}`);
      setIsLoading(false);
    });

    const unsubNotifications = onSnapshot(query(collection(db, "notifications"), orderBy("created_at", "desc"), limit(100)), (snap) => {
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (err) => {
      console.error('AdminPanel: Notifications listener error:', err);
      setLoadError(`Notifications Error: ${err.message}`);
      setIsLoading(false);
    });

    const unsubSubscriptions = onSnapshot(query(collection(db, "subscriptions"), orderBy("created_at", "desc")), (snap) => {
      setSubscriptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (err) => {
      console.error('AdminPanel: Subscriptions listener error:', err);
      setLoadError(`Subscriptions Error: ${err.message}`);
      setIsLoading(false);
    });

    const unsubSupport = onSnapshot(query(collection(db, "support_messages"), orderBy("created_at", "desc")), (snap) => {
      const messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Group by user for the list view
      const userGroups: any = {};
      messages.forEach((m: any) => {
        if (!userGroups[m.user_id]) {
          userGroups[m.user_id] = {
            user_id: m.user_id,
            username: m.username,
            last_message: m.message,
            last_message_at: m.created_at,
            unread_count: messages.filter((msg: any) => msg.user_id === m.user_id && msg.status === 'unread' && msg.sender_role === 'user').length
          };
        }
      });
      setSupportMessages(Object.values(userGroups));
      setIsLoading(false);
    }, (err) => {
      console.error('AdminPanel: Support listener error:', err);
      setLoadError(`Support Error: ${err.message}`);
      setIsLoading(false);
    });

    const unsubSettings = onSnapshot(collection(db, "settings"), (snap) => {
      snap.forEach(doc => {
        if (doc.id === 'home_text') setHomeText(doc.data().value);
        if (doc.id === 'home_font_size') setHomeFontSize(Number(doc.data().value));
        if (doc.id === 'auth_text') setAuthText(doc.data().value);
        if (doc.id === 'sms_support_number') setSmsSupportNumber(doc.data().value);
        if (doc.id === 'bkash_number') setBkashNumber(doc.data().value);
        if (doc.id === 'subscription_amount') setSubscriptionAmount(Number(doc.data().value));
        if (doc.id === 'lock_all_categories') setLockAllCategories(doc.data().value);
      });
      setIsLoading(false);
    }, (err) => {
      console.error('AdminPanel: Settings listener error:', err);
      setLoadError(`Settings Error: ${err.message}`);
      setIsLoading(false);
    });

    const unsubReferrals = onSnapshot(query(collection(db, "referrals"), orderBy("created_at", "desc")), (snap) => {
      setReferrals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (err) => {
      console.error('AdminPanel: Referrals listener error:', err);
      setLoadError(`Referrals Error: ${err.message}`);
      setIsLoading(false);
    });

    return () => {
      unsubUsers();
      unsubBooks();
      unsubDeletedBooks();
      unsubCategories();
      unsubNotifications();
      unsubSubscriptions();
      unsubSupport();
      unsubSettings();
      unsubReferrals();
    };
  }, [navigate]);

  const fetchChatMessages = (userId: number | string) => {
    // This is now handled by the real-time listener if we want, 
    // but for the specific chat view, we can set up a sub-listener
  };

  useEffect(() => {
    if (selectedChatUser) {
      const q = query(collection(db, "support_messages"), where("user_id", "==", selectedChatUser.user_id), orderBy("created_at", "asc"));
      const unsub = onSnapshot(q, (snap) => {
        setChatMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        // Mark as read
        const batch = writeBatch(db);
        snap.docs.forEach(d => {
          if (d.data().status === 'unread' && d.data().sender_role === 'user') {
            batch.update(d.ref, { status: 'read' });
          }
        });
        batch.commit();
      });
      return () => unsub();
    }
  }, [selectedChatUser]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedChatUser) return;

    const currentReply = replyMessage.trim();
    setReplyMessage('');
    setIsSendingReply(true);

    try {
      await addDoc(collection(db, "support_messages"), {
        user_id: selectedChatUser.user_id,
        username: selectedChatUser.username,
        message: currentReply,
        sender_role: 'admin',
        status: 'read',
        created_at: serverTimestamp()
      });
    } catch (err) {
      showToast('রিপ্লাই পাঠানো যায়নি।', 'error');
      setReplyMessage(currentReply);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleDeleteChat = async (userId: number | string) => {
    if (!confirm('Are you sure you want to delete this entire chat?')) return;
    try {
      const q = query(collection(db, "support_messages"), where("user_id", "==", userId));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setSelectedChatUser(null);
      showToast('চ্যাট ডিলিট করা হয়েছে!');
    } catch (err) {
      console.error("Error deleting chat:", err);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleConfirm = (message: string, onConfirm: () => void) => {
    setConfirmConfig({ message, onConfirm });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsAddingCategory(true);
    try {
      await addDoc(collection(db, "categories"), {
        name: newCategoryName,
        is_locked: false,
        sort_index: categories.length,
        created_at: serverTimestamp()
      });
      setNewCategoryName('');
      showToast('ক্যাটাগরি যোগ করা হয়েছে!');
    } catch (error) {
      console.error('Error adding category:', error);
      showToast('Failed to add category', 'error');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleUpdateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      await updateDoc(doc(db, "categories", id), updates);
      setEditingCategoryId(null);
      setEditCategoryPassword('');
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    handleConfirm('Are you sure you want to delete this category?', async () => {
      try {
        await deleteDoc(doc(db, "categories", id));
        showToast('ক্যাটাগরি ডিলিট করা হয়েছে!');
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    });
  };

  const handleToggleLockAll = async (lock: boolean) => {
    try {
      await setDoc(doc(db, "settings", "lock_all_categories"), { value: lock });
      setLockAllCategories(lock);
    } catch (error) {
      console.error('Error toggling lock all:', error);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;

    setIsSendingNotif(true);
    try {
      await addDoc(collection(db, "notifications"), {
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        user_id: notifUserId || null,
        created_at: serverTimestamp()
      });
      showToast('নোটিফিকেশন পাঠানো হয়েছে!');
      setNotifTitle('');
      setNotifMessage('');
      setNotifUserId(null);
    } catch (error) {
      console.error('Error sending notification:', error);
    } finally {
      setIsSendingNotif(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    handleConfirm('আপনি কি নিশ্চিতভাবে এই নোটিফিকেশনটি ডিলিট করতে চান?', async () => {
      try {
        await deleteDoc(doc(db, "notifications", id));
        showToast('নোটিফিকেশন ডিলিট করা হয়েছে!');
      } catch (error) {
        console.error('Error deleting notification:', error);
      }
    });
  };

  const AdminNotificationItem: React.FC<{ notif: any, onDelete: (id: string) => void }> = ({ notif, onDelete }) => {
    const [replies, setReplies] = useState<any[]>([]);
    const [showReplies, setShowReplies] = useState(false);

    useEffect(() => {
      if (showReplies) {
        const q = query(collection(db, "notification_replies"), where("notification_id", "==", notif.id), orderBy("created_at", "asc"));
        const unsub = onSnapshot(q, (snap) => {
          setReplies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
      }
    }, [showReplies]);

    return (
      <div className="p-4 flex flex-col hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
              notif.type === 'success' ? 'bg-emerald-500' :
              notif.type === 'warning' ? 'bg-amber-500' :
              notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`} />
            <div>
              <div className="font-black text-sm">{notif.title}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{notif.message}</div>
              <div className="flex items-center gap-3 mt-2">
                <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                  {safeDate(notif.created_at).toLocaleString('en-GB')}
                </div>
                {notif.user_id ? (
                  <div className="text-[9px] px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest rounded-md">
                    To: {notif.user_name || `User #${notif.user_id}`}
                  </div>
                ) : (
                  <div className="text-[9px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-widest rounded-md">
                    Global
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowReplies(!showReplies)}
              className={`p-2 rounded-lg transition-colors ${showReplies ? 'bg-indigo-100 text-indigo-600' : 'text-zinc-400 hover:bg-zinc-100'}`}
              title="উত্তরগুলো দেখুন"
            >
              <MessageSquare size={16} />
            </button>
            <button
              onClick={() => onDelete(notif.id)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {showReplies && (
          <div className="mt-4 pl-6 border-l-2 border-indigo-100 dark:border-indigo-900/30 space-y-3 animate-in slide-in-from-left-2 duration-200">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">ইউজারদের উত্তরসমূহ ({replies.length})</h4>
            <div className="space-y-2">
              {replies.map(reply => (
                <div key={reply.id} className="bg-zinc-100 dark:bg-zinc-800/50 p-3 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">{reply.username}</span>
                    <span className="text-[8px] text-zinc-400">{safeDate(reply.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-300">{reply.reply}</div>
                </div>
              ))}
              {replies.length === 0 && (
                <div className="text-xs text-zinc-400 font-bold py-2">এখনো কেউ উত্তর দেয়নি</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setCoverUrl(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTogglePremium = async (userId: string, isPaid: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), { 
        is_paid: isPaid,
        trial_ends_at: isPaid ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() : new Date(new Date().setDate(new Date().getDate() + 3)).toISOString()
      });
      showToast(isPaid ? 'ইউজার এখন প্রিমিয়াম!' : 'প্রিমিয়াম স্ট্যাটাস রিমুভ করা হয়েছে।');
    } catch (error) {
      console.error('Error toggling premium:', error);
    }
  };

  const handleUserStatus = async (userId: string, status: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { status });
      showToast('ইউজার স্ট্যাটাস আপডেট করা হয়েছে!');
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const fetchUserNotes = async (userId: string) => {
    setLoadingNotes(true);
    try {
      const q = query(collection(db, "user_notes"), where("user_id", "==", userId), orderBy("updated_at", "desc"));
      const snap = await getDocs(q);
      setUserNotes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Note)));
      setShowNotesModal(true);
    } catch (error) {
      console.error("Failed to fetch notes");
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userDeleteConfirmId !== userId) {
      setUserDeleteConfirmId(userId);
      setTimeout(() => setUserDeleteConfirmId(null), 3000);
      return;
    }

    try {
      await deleteDoc(doc(db, "users", userId));
      setUserDeleteConfirmId(null);
      showToast('ইউজার ডিলিট করা হয়েছে!');
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleUpdatePassword = async () => {
    if (!editingPasswordUserId || !newPassword.trim()) return;
    
    try {
      await updateDoc(doc(db, "users", String(editingPasswordUserId)), { password: newPassword.trim() });
      showToast('পাসওয়ার্ড আপডেট হয়েছে!');
      setEditingPasswordUserId(null);
      setNewPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
    }
  };

  const handleUpdateOrder = async () => {
    if (!editingOrderBookId) return;
    
    try {
      await updateDoc(doc(db, "books", String(editingOrderBookId)), { sort_index: newOrderIndex });
      showToast('সিরিয়াল আপডেট হয়েছে!');
      setEditingOrderBookId(null);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const handleUpdateTrial = async (userId: string) => {
    if (!newTrialDate) return;
    try {
      await updateDoc(doc(db, "users", userId), { trial_ends_at: safeDate(newTrialDate).toISOString() });
      showToast('মেয়াদ আপডেট হয়েছে!');
      setEditingTrialUserId(null);
    } catch (error) {
      console.error('Error updating trial date:', error);
    }
  };

  const handleApproveSubscription = async (subId: string, userId: string) => {
    handleConfirm('আপনি কি নিশ্চিতভাবে এই সাবস্ক্রিপশনটি এপ্রুভ করতে চান?', async () => {
      try {
        await runTransaction(db, async (transaction) => {
          const subRef = doc(db, "subscriptions", subId);
          const userRef = doc(db, "users", userId);
          
          transaction.update(subRef, { status: 'approved' });
          
          const now = new Date();
          const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
          
          transaction.update(userRef, { 
            is_paid: true, 
            status: 'active', 
            trial_ends_at: nextYear.toISOString(),
            has_pending_subscription: false
          });

          const notifRef = doc(collection(db, "notifications"));
          transaction.set(notifRef, {
            user_id: userId,
            title: "সাবস্ক্রিপশন সফল!",
            message: "আপনার ১ বছরের সাবস্ক্রিপশন সফলভাবে একটিভ করা হয়েছে। ধন্যবাদ!",
            type: "success",
            created_at: serverTimestamp()
          });
        });
        showToast('সাবস্ক্রিপশন এপ্রুভ হয়েছে!');
      } catch (error) {
        console.error('Error approving subscription:', error);
        showToast('Failed to approve subscription', 'error');
      }
    });
  };

  const handleRejectSubscription = async (subId: string, userId: string) => {
    handleConfirm('আপনি কি নিশ্চিতভাবে এই সাবস্ক্রিপশনটি রিজেক্ট করতে চান?', async () => {
      try {
        await updateDoc(doc(db, "subscriptions", subId), { status: 'rejected' });
        await updateDoc(doc(db, "users", userId), { has_pending_subscription: false });
        await addDoc(collection(db, "notifications"), {
          user_id: userId,
          title: "পেমেন্ট রিজেক্ট করা হয়েছে",
          message: "আপনার পেমেন্ট রিকোয়েস্টটি সঠিক না হওয়ায় রিজেক্ট করা হয়েছে। দয়া করে সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।",
          type: "error",
          created_at: serverTimestamp()
        });
        showToast('সাবস্ক্রিপশন রিজেক্ট হয়েছে!');
      } catch (error) {
        console.error('Error rejecting subscription:', error);
      }
    });
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverUrl) {
      showToast('অনুগ্রহ করে একটি ছবি নির্বাচন করুন', 'error');
      return;
    }

    const finalCategory = category.includes('New book') ? category : `New book, ${category}`;
    const bookData = {
      title,
      author,
      cover_url: coverUrl,
      pdf_url: pdfUrl,
      category: finalCategory,
      content: JSON.stringify(pages.filter(p => p.trim() !== '')),
      description: description,
      is_deleted: false,
      sort_index: editingBookId ? books.find(b => b.id === editingBookId)?.sort_index || 0 : books.length,
      created_at: serverTimestamp()
    };

    try {
      if (editingBookId) {
        await updateDoc(doc(db, "books", String(editingBookId)), bookData);
        showToast('বইটি আপডেট করা হয়েছে!');
      } else {
        await addDoc(collection(db, "books"), bookData);
        showToast('বইটি সফলভাবে যোগ করা হয়েছে!');
      }
      resetForm();
    } catch (error) {
      console.error('Error saving book:', error);
      showToast('Failed to save book', 'error');
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "settings", "home_text"), { value: homeText });
      batch.set(doc(db, "settings", "home_font_size"), { value: homeFontSize.toString() });
      batch.set(doc(db, "settings", "auth_text"), { value: authText });
      batch.set(doc(db, "settings", "sms_support_number"), { value: smsSupportNumber });
      batch.set(doc(db, "settings", "bkash_number"), { value: bkashNumber });
      batch.set(doc(db, "settings", "subscription_amount"), { value: subscriptionAmount.toString() });
      await batch.commit();
      showToast('সেটিংস আপডেট করা হয়েছে!');
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id as any);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteBook = async (book: Book) => {
    if (deleteConfirmId !== book.id) {
      setDeleteConfirmId(book.id as any);
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }

    setIsDeleting(true);
    try {
      await updateDoc(doc(db, "books", String(book.id)), { is_deleted: true });
      setDeleteConfirmId(null);
      showToast('বইটি রিসাইকেল বিনে পাঠানো হয়েছে!');
    } catch (error) {
      console.error('Error deleting book:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreBook = async (id: string) => {
    if (restoreConfirmId !== id) {
      setRestoreConfirmId(id as any);
      setTimeout(() => setRestoreConfirmId(null), 3000);
      return;
    }

    try {
      await updateDoc(doc(db, "books", id), { is_deleted: false });
      setRestoreConfirmId(null);
      showToast('বইটি রিস্টোর করা হয়েছে!');
    } catch (error) {
      console.error('Error restoring book:', error);
    }
  };

  const handlePermanentDeleteBook = async (id: string) => {
    if (permDeleteConfirmId !== id) {
      setPermDeleteConfirmId(id as any);
      setTimeout(() => setPermDeleteConfirmId(null), 3000);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "books", id));
      setPermDeleteConfirmId(null);
      showToast('বইটি চিরতরে ডিলিট করা হয়েছে!');
    } catch (error) {
      console.error('Error permanently deleting book:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditBook = (book: Book) => {
    setEditingBookId(book.id as any);
    setTitle(book.title);
    setAuthor(book.author || '');
    setCoverUrl(book.cover_url);
    setPdfUrl(book.pdf_url || '');
    // If category is "New book, Love Story", set primary category to "Love Story"
    const categories = book.category?.split(', ') || [];
    const primaryCategory = categories.length > 1 ? categories[1] : categories[0];
    setCategory(primaryCategory || 'New book');
    setDescription(book.description || '');
    try {
      const parsedPages = JSON.parse(book.content);
      const loadedPages = Array.isArray(parsedPages) ? parsedPages : [book.content];
      setPages(loadedPages.length > 0 ? loadedPages : ['']);
    } catch (e) {
      setPages(book.content ? [book.content] : ['']);
    }
    setImagePreview(book.cover_url);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingBookId(null);
    setTitle('');
    setAuthor('');
    setCoverUrl('');
    setPdfUrl('');
    setCategory('New book');
    setDescription('');
    setPages(['']);
    setBulkText('');
    setShowBulkImport(false);
    setImagePreview(null);
    setShowForm(false);
  };

  const handleBulkImport = () => {
    if (!bulkText.trim()) return;
    
    // Standardize markers to a single delimiter
    const delimiter = "---PAGE_BREAK---";
    let processedText = bulkText;

    // 1. Handle specific word markers: Page X, পৃষ্ঠা X, সূত্র X (supporting both English and Bengali digits)
    const wordMarkers = [
      /Page\s*(\d+|[০-৯]+)/gi, 
      /\[Page\s*(\d+|[০-৯]+)\]/gi, 
      /পৃষ্ঠা\s*(\d+|[০-৯]+)/gi, 
      /সূত্র\s*(\d+|[০-৯]+)/gi
    ];
    
    wordMarkers.forEach(marker => {
      processedText = processedText.replace(marker, delimiter);
    });

    // 2. Handle standalone numbers on their own line (e.g., "1", "১", "2", "২" at start of line)
    // Supporting both English (0-9) and Bengali (০-৯) digits
    const standaloneNumberMarker = /^\s*(\d+|[০-৯]+)\s*$/gm;
    processedText = processedText.replace(standaloneNumberMarker, delimiter);

    const splitPages = processedText
      .split(delimiter)
      .map(p => p.trim())
      .filter(p => p !== '');

    if (splitPages.length > 0) {
      setPages(splitPages);
      setShowBulkImport(false);
      showToast(`${splitPages.length} টি পৃষ্ঠা সফলভাবে তৈরি করা হয়েছে!`);
    } else {
      showToast('কোন পৃষ্ঠা পাওয়া যায়নি। অনুগ্রহ করে পৃষ্ঠা নম্বর (১, ২, ৩...) বা মার্কার ব্যবহার করুন।', 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const query = userSearch.toLowerCase().trim();
    const username = (u.username || "").toLowerCase();
    const fullName = (u.fullName || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const deviceId = (u.device_id || "").toLowerCase();
    
    const matchesSearch = username.includes(query) || fullName.includes(query) || email.includes(query) || deviceId.includes(query);
    
    if (!matchesSearch) return false;
    
    if (userStatusFilter === 'all') return true;
    if (userStatusFilter === 'online') {
      if (!u.last_active_at) return false;
      const lastActive = safeDate(u.last_active_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
      return diffMinutes < 5; // Online if active in last 5 mins
    }
    if (userStatusFilter === 'offline') {
      if (!u.last_active_at) return true;
      const lastActive = safeDate(u.last_active_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
      return diffMinutes >= 5; // Offline if not active in last 5 mins
    }
    if (userStatusFilter === 'expired') {
      if (!u.trialEndsAt) return false;
      return new Date() > safeDate(u.trialEndsAt);
    }
    return u.status === userStatusFilter;
  });

  const filteredReferrals = referrals.map(r => {
    const referrer = users.find(u => u.id === r.referrer_id);
    const referee = users.find(u => u.id === r.referee_id);
    return {
      ...r,
      referrer_username: referrer ? referrer.username : 'Unknown',
      referee_username: referee ? referee.username : 'Unknown'
    };
  }).filter(r => {
    const query = referralSearch.toLowerCase();
    const referrer = (r.referrer_username || "").toLowerCase();
    const referee = (r.referee_username || "").toLowerCase();
    return referrer.includes(query) || referee.includes(query);
  });

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(bookSearch.toLowerCase()) || 
    (b.author || "").toLowerCase().includes(bookSearch.toLowerCase())
  );
  const filteredDeletedBooks = deletedBooks.filter(b => b.title.toLowerCase().includes(recycleSearch.toLowerCase()));

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-zinc-950 p-4 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-8 rounded-3xl border border-red-100 dark:border-red-900/30 max-w-md w-full shadow-2xl shadow-red-500/10">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">লোড করতে সমস্যা হয়েছে</h2>
          <p className="text-sm text-red-500/80 mb-6 font-mono break-words">{loadError}</p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
            >
              আবার চেষ্টা করুন
            </button>
            <button 
              onClick={() => setLoadError(null)}
              className="w-full py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-300 transition-all"
            >
              Skip Error & Enter
            </button>
            <button 
              onClick={() => navigate('/')}
              className="text-zinc-500 hover:underline text-xs font-bold mt-2"
            >
              Go Back Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-gray-500 animate-pulse">অ্যাডমিন প্যানেল লোড হচ্ছে...</p>
        <div className="mt-4 text-[10px] text-gray-300 font-mono">
          {loadError ? `Error: ${loadError}` : "Fetching data from Firestore..."}
        </div>
        {loadError && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg max-w-md text-center">
            <p className="font-bold mb-2">Error Loading Data:</p>
            <p className="text-sm font-mono">{loadError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {!loadError && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[10px] text-zinc-400 font-mono animate-pulse">
              Connecting to Firestore...
            </div>
            <button 
              onClick={() => setIsLoading(false)}
              className="mt-4 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-all"
            >
              Skip Loading (Force Open)
            </button>
            <button 
              onClick={() => navigate('/')}
              className="text-emerald-600 hover:underline text-sm font-bold"
            >
              Go Back Home
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-20">
      <header className="bg-white dark:bg-zinc-900 border-b border-black/5 dark:border-white/5 p-3 sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-black tracking-tight">Admin Panel</h1>
          </div>
          <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
            RJ Jisan Access
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-3 md:p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-black/5 dark:border-white/5 shadow-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab('books')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'books' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' : 'text-zinc-400'}`}
          >
            Books
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' : 'text-zinc-400'}`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('recycle')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'recycle' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400'}`}
          >
            Recycle Bin
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-amber-500 text-white shadow-md' : 'text-zinc-400'}`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'referrals' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400'}`}
          >
            Referrals
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'notifications' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400'}`}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'categories' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-400'}`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'subscriptions' ? 'bg-rose-600 text-white shadow-md' : 'text-zinc-400'}`}
          >
            Subscriptions
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'support' ? 'bg-rose-500 text-white shadow-md' : 'text-zinc-400'}`}
          >
            Support
          </button>
        </div>

        {activeTab === 'books' ? (
          <div className="space-y-6">
            {/* Book List with Search */}
            <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden">
              <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black tracking-tight">বই তালিকা (Books)</h2>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{books.length} Books</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    placeholder="বই খুঁজুন..."
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[500px] overflow-y-auto">
                {filteredBooks.map(book => (
                  <div key={book.id} className="p-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={book.cover_url} className="w-10 h-14 object-cover rounded-lg shadow-sm" alt="" />
                        <div className="absolute -top-2 -left-2 w-5 h-5 bg-blue-600 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-md border border-white dark:border-zinc-900">
                          {book.sort_index || 0}
                        </div>
                      </div>
                      <div>
                        <div className="font-black text-sm line-clamp-1">{book.title}</div>
                        <div className="text-[10px] text-zinc-500 font-bold">{book.author || "অজানা লেখক"}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">সিরিয়াল: {book.sort_index || 0}</span>
                          {book.category?.split(', ').map(cat => (
                            <span key={cat} className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">{cat}</span>
                          ))}
                          <span className="text-[8px] text-zinc-400 uppercase tracking-widest">Added on {safeDate(book.created_at!).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          setEditingOrderBookId(book.id);
                          setNewOrderIndex(book.sort_index || 0);
                        }} 
                        className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                        title="সিরিয়াল সেট করুন"
                      >
                        <ArrowUpNarrowWide size={16} />
                      </button>
                      <button onClick={() => handleEditBook(book)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="এডিট করুন">
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteBook(book)} 
                        disabled={isDeleting}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all border font-black uppercase tracking-tighter text-[10px] ${
                          deleteConfirmId === book.id 
                            ? 'bg-red-600 text-white border-red-600 animate-pulse' 
                            : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-100 dark:border-red-900/20'
                        }`}
                        title={deleteConfirmId === book.id ? "নিশ্চিত করুন" : "মুছে ফেলুন"}
                      >
                        <Trash2 size={14} />
                        <span>{deleteConfirmId === book.id ? "নিশ্চিত?" : "ডিলিট"}</span>
                      </button>
                    </div>
                  </div>
                ))}
                {filteredBooks.length === 0 && (
                  <div className="p-8 text-center text-zinc-400 text-xs font-bold">কোন বই পাওয়া যায়নি</div>
                )}
              </div>
            </section>
          </div>
        ) : activeTab === 'users' ? (
          /* User Management Section */
          <>
            <div className="flex flex-col min-h-[calc(100vh-200px)]">
              <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-tight">ইউজার ম্যানেজমেন্ট</h2>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{users.length} Users</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                      type="text"
                      placeholder="সার্চ নাম বা ডিভাইস আইডি..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-none text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                    />
                  </div>
                  
                  {/* User Status Filter */}
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {[
                      { id: 'all', label: 'সব ইউজার', count: users.length, color: 'bg-zinc-500' },
                      { id: 'online', label: 'অনলাইন', count: users.filter(u => u.last_active_at && (new Date().getTime() - safeDate(u.last_active_at).getTime() < 300000)).length, color: 'bg-emerald-500' },
                      { id: 'offline', label: 'অফলাইন', count: users.filter(u => !u.last_active_at || (new Date().getTime() - safeDate(u.last_active_at).getTime() >= 300000)).length, color: 'bg-zinc-400' },
                      { id: 'expired', label: 'মেয়াদ শেষ', count: users.filter(u => u.trialEndsAt && new Date() > safeDate(u.trialEndsAt)).length, color: 'bg-orange-500' },
                      { id: 'pending', label: 'পেন্ডিং', count: users.filter(u => u.status === 'pending').length, color: 'bg-amber-500' },
                      { id: 'active', label: 'একটিভ', count: users.filter(u => u.status === 'active').length, color: 'bg-blue-500' },
                      { id: 'blocked', label: 'ব্লক করা', count: users.filter(u => u.status === 'blocked').length, color: 'bg-red-500' }
                    ].map(filter => (
                      <button
                        key={filter.id}
                        onClick={() => setUserStatusFilter(filter.id as any)}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                          userStatusFilter === filter.id 
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md scale-105' 
                          : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-black/5 dark:border-white/5'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${filter.color}`}></div>
                        {filter.label}
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${
                          userStatusFilter === filter.id 
                          ? 'bg-white/20 text-white' 
                          : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
                        }`}>
                          {filter.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {filteredUsers.map(user => {
                    const isExpanded = expandedUserId === user.id;
                    const regDate = user.created_at 
                      ? new Intl.DateTimeFormat('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit'
                        }).format(safeDate(user.created_at))
                      : "N/A";

                    return (
                      <div key={user.id} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-md border border-black/5 dark:border-white/5 overflow-hidden transition-all hover:shadow-lg">
                        <div 
                          className="p-4 flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-100 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                                <img 
                                  src={user.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              {/* Online Status Indicator */}
                              {user.last_active_at && (new Date().getTime() - new Date(user.last_active_at).getTime() < 300000) && (
                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-zinc-800 rounded-full shadow-sm"></div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-black text-lg tracking-tight text-zinc-900 dark:text-white leading-tight">
                                  {user.fullName || user.username}
                                </div>
                                {user.last_active_at && (new Date().getTime() - safeDate(user.last_active_at).getTime() < 300000) && (
                                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">Active Now</span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-bold">{user.email || "No email set"}</div>
                              {user.last_active_at && (
                                <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                                  Last Active: {safeDate(user.last_active_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </div>
                              )}
                              <div className="text-[10px] text-zinc-400">Joined: {regDate}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {user.isPaid && (
                              <div className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                <ShieldCheck size={8} />
                                Premium
                              </div>
                            )}
                            {user.hasPendingSubscription && (
                              <div className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[8px] font-black uppercase tracking-widest animate-pulse">
                                Pending
                              </div>
                            )}
                            <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${user.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                              {user.status}
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteUser(user.id);
                              }}
                              className={`p-2 rounded-xl transition-all ${
                                userDeleteConfirmId === user.id 
                                  ? 'bg-red-600 text-white animate-pulse' 
                                  : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                              }`}
                              title={userDeleteConfirmId === user.id ? "নিশ্চিত করুন" : "ইউজার ডিলিট করুন"}
                            >
                              <Trash size={18} />
                            </button>
                            {isExpanded ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 pt-0 border-t border-black/5 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="py-4 space-y-4">
                              {/* Password Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm">পাসওয়ার্ড: </span>
                                  <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">{user.password || "N/A"}</span>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingPasswordUserId(user.id);
                                    setNewPassword(user.password || '');
                                  }}
                                  className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors"
                                >
                                  <Edit2 size={18} />
                                </button>
                              </div>
                              
                              <hr className="border-black/5 dark:border-white/5" />

                              {/* Trial Expiry Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Trial Expiry</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-black ${safeDate(user.trialEndsAt) < new Date() ? 'text-red-500' : 'text-emerald-500'}`}>
                                      {safeDate(user.trialEndsAt).toLocaleDateString('en-GB')}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                      ({Math.ceil((safeDate(user.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left)
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingTrialUserId(user.id);
                                    // Format for datetime-local input: YYYY-MM-DDTHH:mm
                                    const date = safeDate(user.trialEndsAt);
                                    const formattedDate = date.toISOString().slice(0, 16);
                                    setNewTrialDate(formattedDate);
                                  }}
                                  className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                                >
                                  <Edit3 size={18} />
                                </button>
                              </div>

                              {editingTrialUserId === user.id && (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-3 animate-in slide-in-from-top-2">
                                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">নতুন মেয়াদ সেট করুন</div>
                                  <div className="flex gap-2">
                                    <input
                                      type="datetime-local"
                                      value={newTrialDate}
                                      onChange={(e) => setNewTrialDate(e.target.value)}
                                      className="flex-1 px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border-none text-sm outline-none ring-1 ring-indigo-200 dark:ring-indigo-900/50"
                                    />
                                    <button
                                      onClick={() => handleUpdateTrial(user.id)}
                                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const oneYearFromNow = new Date();
                                        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                                        const isoDate = oneYearFromNow.toISOString();
                                        try {
                                          await updateDoc(doc(db, "users", String(user.id)), { trial_ends_at: isoDate });
                                          setEditingTrialUserId(null);
                                          showToast('মেয়াদ ১ বছর বাড়ানো হয়েছে!');
                                        } catch (error) {
                                          console.error('Error auto-updating trial:', error);
                                        }
                                      }}
                                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                                    >
                                      Auto (1 Year)
                                    </button>
                                    <button
                                      onClick={() => setEditingTrialUserId(null)}
                                      className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-300 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              <hr className="border-black/5 dark:border-white/5" />
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-black/5 dark:border-white/5">
                                  <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Last Login</div>
                                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    {user.last_login_at ? safeDate(user.last_login_at).toLocaleString('en-GB') : 'Never'}
                                  </div>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-black/5 dark:border-white/5">
                                  <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Last Active</div>
                                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    {user.last_active_at ? safeDate(user.last_active_at).toLocaleString('en-GB') : 'Never'}
                                  </div>
                                </div>
                              </div>

                              <hr className="border-black/5 dark:border-white/5" />

                              {/* Location Row */}
                              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                                    <MapPin size={16} />
                                  </div>
                                  <div>
                                    <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">User Location</div>
                                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                      {user.latitude && user.longitude 
                                        ? `${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}`
                                        : 'Location not available'}
                                    </div>
                                  </div>
                                </div>
                                {user.latitude && user.longitude && (
                                  <a 
                                    href={`https://www.google.com/maps?q=${user.latitude},${user.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-emerald-500/20 hover:scale-105 transition-transform"
                                  >
                                    View Map
                                  </a>
                                )}
                              </div>

                              <hr className="border-black/5 dark:border-white/5" />

                              {/* Device ID Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate">Device ID: {user.device_id || "No ID"}</div>
                                </div>
                                <button
                                  onClick={() => {
                                    if (user.device_id) {
                                      navigator.clipboard.writeText(user.device_id);
                                      showToast('ID কপি হয়েছে!');
                                    }
                                  }}
                                  className="p-2 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                                >
                                  <Copy size={16} />
                                </button>
                              </div>

                              <hr className="border-black/5 dark:border-white/5" />
                              
                              {/* User Notes Section */}
                              <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Edit3 size={14} className="text-amber-600" />
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">User Notepad</span>
                                  </div>
                                  <button 
                                    onClick={() => fetchUserNotes(user.id)}
                                    className="text-[10px] font-black text-amber-600 uppercase tracking-widest hover:underline"
                                  >
                                    View All ({user.notes_count || 0})
                                  </button>
                                </div>
                                <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap italic line-clamp-2">
                                  {user.notes || "ইউজার এখনো কোনো নোট লিখেননি।"}
                                </div>
                              </div>

                              <hr className="border-black/5 dark:border-white/5" />
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Status: </span>
                                    <button
                                      onClick={() => handleUserStatus(user.id, user.status === 'active' ? 'blocked' : 'active')}
                                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                                        user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                          user.status === 'active' ? 'translate-x-6' : 'translate-x-0.5'
                                        }`}
                                      />
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Premium: </span>
                                    <button
                                      onClick={() => handleTogglePremium(user.id, !user.isPaid)}
                                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                                        user.isPaid ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                          user.isPaid ? 'translate-x-6' : 'translate-x-0.5'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedUser(user)}
                                    className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                                  >
                                    Full Detail
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleConfirm(`আপনি কি নিশ্চিতভাবে ${user.username} অ্যাকাউন্টটি ডিলিট করতে চান?`, () => {
                                        handleDeleteUser(user.id);
                                      });
                                    }}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  >
                                    <Trash size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <div className="py-12 text-center text-zinc-400 text-sm font-bold">কোনো ইউজার পাওয়া যায়নি!</div>
                  )}
                </div>

                {/* Footer Branding inside Section */}
                <div className="bg-zinc-100 dark:bg-zinc-800/50 py-3 text-center">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
                  </p>
                </div>
              </section>
            </div>
          </>
        ) : activeTab === 'categories' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-xl text-blue-600">
                    <List size={20} />
                  </div>
                  <h2 className="text-lg font-black tracking-tight">ক্যাটাগরি ম্যানেজমেন্ট</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lock All</span>
                  <button
                    onClick={() => handleToggleLockAll(!lockAllCategories)}
                    className={`w-12 h-6 rounded-full transition-all relative ${lockAllCategories ? 'bg-red-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${lockAllCategories ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/30">
                <form onSubmit={handleAddCategory} className="flex gap-3">
                  <input
                    type="text"
                    placeholder="নতুন ক্যাটাগরির নাম..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isAddingCategory}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isAddingCategory ? 'যোগ হচ্ছে...' : 'অ্যাড করুন'}
                  </button>
                </form>
              </div>

              <div className="divide-y divide-black/5 dark:divide-white/5">
                <div className="p-4 bg-zinc-100/50 dark:bg-zinc-800/50">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                      type="text"
                      placeholder="ক্যাটাগরি সার্চ করুন..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border-none text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                {categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(cat => (
                  <div key={cat.id} className="p-4 flex flex-col gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-xs font-black text-zinc-400 w-4">{cat.sort_index}</div>
                        {editingCategoryId === cat.id ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-zinc-400 uppercase w-12">Serial:</span>
                              <input
                                type="number"
                                value={editCategorySortIndex}
                                onChange={(e) => setEditCategorySortIndex(parseInt(e.target.value) || 0)}
                                className="w-16 px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-blue-500 text-sm outline-none"
                              />
                            </div>
                            <input
                              type="text"
                              value={editCategoryName}
                              onChange={(e) => setEditCategoryName(e.target.value)}
                              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-blue-500 text-sm outline-none"
                              placeholder="Category Name"
                            />
                            <input
                              type="text"
                              value={editCategoryPassword}
                              onChange={(e) => setEditCategoryPassword(e.target.value)}
                              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-blue-500 text-sm outline-none"
                              placeholder="Password (optional)"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateCategory(cat.id, { name: editCategoryName, password: editCategoryPassword, sort_index: editCategorySortIndex })}
                                className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCategoryId(null)}
                                className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 text-[10px] font-black uppercase rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{cat.name}</span>
                            {cat.is_locked && (
                              <div className="flex items-center gap-1">
                                <Lock size={12} className="text-red-500" />
                                {cat.password && <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">PW Set</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateCategory(cat.id, { is_locked: !cat.is_locked })}
                          className={`p-2 rounded-lg transition-colors ${cat.is_locked ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                          title={cat.is_locked ? "আনলক করুন" : "লক করুন"}
                        >
                          {cat.is_locked ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>
                        <button
                          onClick={() => {
                            setEditingCategoryId(cat.id);
                            setEditCategoryName(cat.name);
                            setEditCategoryPassword(cat.password || '');
                            setEditCategorySortIndex(cat.sort_index);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : activeTab === 'subscriptions' ? (
          /* Subscriptions Management Section */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/20 rounded-xl text-rose-600">
                    <History size={20} />
                  </div>
                  <h2 className="text-lg font-black tracking-tight">সাবস্ক্রিপশন ম্যানেজমেন্ট</h2>
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{subscriptions.length} Requests</span>
              </div>

              <div className="divide-y divide-black/5 dark:divide-white/5">
                {subscriptions.length === 0 && (
                  <div className="p-12 text-center">
                    <History size={48} className="mx-auto text-zinc-200 mb-4" />
                    <p className="text-zinc-400 font-bold">কোন সাবস্ক্রিপশন রিকোয়েস্ট পাওয়া যায়নি</p>
                  </div>
                )}
                {subscriptions.map(sub => (
                  <div key={sub.id} className="p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm">{sub.full_name || sub.username}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            sub.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                            sub.status === 'rejected' ? 'bg-red-100 text-red-600' :
                            'bg-amber-100 text-amber-600'
                          }`}>
                            {sub.status}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 font-bold">Amount: {sub.amount} TK</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">
                          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Sender Info (Last Digit): <span className="text-zinc-900 dark:text-white">{sub.bkash_number}</span></div>
                          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Transaction ID: <span className="text-zinc-900 dark:text-white">{sub.transaction_id}</span></div>
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-1">
                          Requested: {safeDate(sub.created_at).toLocaleString('en-GB')}
                        </div>
                      </div>

                      {sub.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveSubscription(sub.id, sub.user_id)}
                            className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectSubscription(sub.id, sub.user_id)}
                            className="flex-1 md:flex-none px-4 py-2 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : activeTab === 'notifications' ? (
          /* Notifications Section */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                  <Bell size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">নতুন নোটিফিকেশন পাঠান</h2>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Send Push Notifications to Users</p>
                </div>
              </div>

              <form onSubmit={handleSendNotification} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Notification Title</label>
                    <input
                      type="text"
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="শিরোনাম (যেমন: নতুন বই এসেছে!)"
                      className="w-full p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Type</label>
                    <select
                      value={notifType}
                      onChange={(e) => setNotifType(e.target.value)}
                      className="w-full p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    >
                      <option value="info">Info (Blue)</option>
                      <option value="success">Success (Green)</option>
                      <option value="warning">Warning (Yellow)</option>
                      <option value="error">Error (Red)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Target User (Optional)</label>
                    <select
                      value={notifUserId || ''}
                      onChange={(e) => setNotifUserId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    >
                      <option value="">All Users (Global)</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName || u.username} ({u.username})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Message Content</label>
                  <textarea
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    rows={4}
                    placeholder="আপনার মেসেজটি এখানে লিখুন..."
                    className="w-full p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSendingNotif}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSendingNotif ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send size={20} />
                  )}
                  {isSendingNotif ? 'Sending...' : 'Send Notification'}
                </button>
              </form>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden">
              <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-lg font-black tracking-tight">আগের নোটিফিকেশনসমূহ</h2>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{notifications.length} Sent</span>
              </div>
              <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[400px] overflow-y-auto">
                {notifications.map(notif => (
                  <AdminNotificationItem key={notif.id} notif={notif} onDelete={handleDeleteNotification} />
                ))}
                {notifications.length === 0 && (
                  <div className="p-12 text-center text-zinc-400 text-sm font-bold">কোনো নোটিফিকেশন পাঠানো হয়নি</div>
                )}
              </div>
            </section>
          </div>
        ) : activeTab === 'support' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px] animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* User List */}
            <section className="lg:col-span-1 bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/20 rounded-xl text-rose-600">
                    <MessageSquare size={20} />
                  </div>
                  <h2 className="text-lg font-black tracking-tight">সাপোর্ট চ্যাট</h2>
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{supportMessages.length} Users</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
                {supportMessages.map(user => (
                  <button
                    key={user.user_id}
                    onClick={() => {
                      setSelectedChatUser({ user_id: user.user_id, username: user.username });
                      fetchChatMessages(user.user_id);
                    }}
                    className={`w-full p-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all flex items-center gap-4 relative ${selectedChatUser?.user_id === user.user_id ? 'bg-zinc-50 dark:bg-zinc-800/50 ring-1 ring-inset ring-black/5 dark:ring-white/5' : ''}`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 font-black text-lg shadow-sm">
                        {user.username?.[0]?.toUpperCase() || 'G'}
                      </div>
                      {user.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 animate-bounce">
                          {user.unread_count}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-sm truncate">{user.username}</span>
                        <span className="text-[8px] font-bold text-zinc-400 uppercase">
                          {safeDate(user.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-medium">
                        {user.last_message}
                      </p>
                    </div>
                  </button>
                ))}
                {supportMessages.length === 0 && (
                  <div className="py-20 text-center space-y-4 opacity-50">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                      <MessageSquare size={32} />
                    </div>
                    <p className="text-zinc-400 text-sm font-bold">কোনো চ্যাট নেই!</p>
                  </div>
                )}
              </div>
            </section>

            {/* Chat Window */}
            <section className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden flex flex-col">
              {selectedChatUser ? (
                <>
                  {/* Chat Header */}
                  <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/20 rounded-xl flex items-center justify-center text-rose-600 font-black">
                        {selectedChatUser.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-black text-sm">{selectedChatUser.username}</h3>
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Online Support Session</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteChat(selectedChatUser.user_id)}
                      className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                      title="Delete entire chat"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30 dark:bg-zinc-950/10">
                    {chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] space-y-1`}>
                          <div className={`flex items-center gap-1.5 mb-1 ${msg.sender_role === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                              {msg.sender_role === 'admin' ? 'You' : msg.username}
                            </span>
                          </div>
                          <div
                            className={`p-4 rounded-2xl text-sm font-medium shadow-sm ${
                              msg.sender_role === 'admin'
                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-tr-none'
                                : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-none border border-black/5 dark:border-white/5'
                            }`}
                          >
                            {msg.message}
                          </div>
                          <p className={`text-[8px] font-bold text-zinc-400 ${msg.sender_role === 'admin' ? 'text-right' : 'text-left'}`}>
                            {safeDate(msg.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <div className="p-6 border-t border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900">
                    <form onSubmit={handleSendReply} className="relative">
                      <textarea
                        required
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply(e);
                          }
                        }}
                        placeholder="রিপ্লাই লিখুন..."
                        className="w-full pl-5 pr-14 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm outline-none focus:ring-2 focus:ring-rose-500 transition-all font-medium resize-none h-14"
                      />
                      <button
                        type="submit"
                        disabled={isSendingReply || !replyMessage.trim()}
                        className="absolute right-2 top-2 bottom-2 w-10 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-rose-500/20"
                      >
                        {isSendingReply ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6 opacity-30">
                  <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                    <MessageSquare size={48} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black">চ্যাট সিলেক্ট করুন</h3>
                    <p className="text-sm font-bold max-w-xs mx-auto">বাম পাশের লিস্ট থেকে কোনো ইউজারের চ্যাট সিলেক্ট করে রিপ্লাই দিন।</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : activeTab === 'settings' ? (
          /* Settings Section */
          <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 space-y-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-black tracking-tight leading-tight">হোম পেজ লেখা ও সাইজ</h2>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Home Page Motivation & Font Control</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Auth Page Motivational Text</label>
                  <textarea
                    value={authText}
                    onChange={(e) => setAuthText(e.target.value)}
                    rows={10}
                    placeholder="লগইন পেজের মোটিভেশনাল লেখা এখানে লিখুন..."
                    className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all resize-none font-medium"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Home Page Motivational Text</label>
                  <textarea
                    value={homeText}
                    onChange={(e) => setHomeText(e.target.value)}
                    rows={6}
                    placeholder="মোটিভেশনাল লেখা এখানে লিখুন..."
                    className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all resize-none font-medium"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">ফন্ট সাইজ: {homeFontSize}</label>
                    <span className="text-[10px] font-black text-zinc-400">Range: 12 - 30</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="30"
                    step="1"
                    value={homeFontSize}
                    onChange={(e) => setHomeFontSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">SMS Support Number</label>
                  <input
                    type="text"
                    value={smsSupportNumber}
                    onChange={(e) => setSmsSupportNumber(e.target.value)}
                    placeholder="যেমন: +8801700000000"
                    className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">bKash Number (Personal)</label>
                    <input
                      type="text"
                      value={bkashNumber}
                      onChange={(e) => setBkashNumber(e.target.value)}
                      placeholder="যেমন: 01613071344"
                      className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Subscription Amount (BDT)</label>
                    <input
                      type="number"
                      value={subscriptionAmount}
                      onChange={(e) => setSubscriptionAmount(parseInt(e.target.value))}
                      placeholder="যেমন: 100"
                      className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleUpdateSettings}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Save size={20} />
                    আপডেট করুন
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* Recycle Bin Section */
          <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="text-red-500" size={20} />
                  <h2 className="text-lg font-black tracking-tight">রিসাইকেল বিন (Recycle Bin)</h2>
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{deletedBooks.length} Deleted</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="text"
                  placeholder="মুছে ফেলা বই খুঁজুন..."
                  value={recycleSearch}
                  onChange={(e) => setRecycleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[500px] overflow-y-auto">
              {filteredDeletedBooks.map(book => (
                <div key={book.id} className="p-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <img src={book.cover_url} className="w-10 h-14 object-cover rounded-lg shadow-sm grayscale" alt="" />
                    <div>
                      <div className="font-black text-sm line-clamp-1 text-zinc-400">{book.title}</div>
                      <div className="text-[8px] text-zinc-400 uppercase tracking-widest italic">Deleted Item</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestoreBook(book.id)}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                        restoreConfirmId === book.id 
                          ? 'bg-emerald-600 text-white animate-pulse' 
                          : 'bg-emerald-500 text-white hover:bg-emerald-600'
                      }`}
                    >
                      {restoreConfirmId === book.id ? "Confirm?" : "Restore"}
                    </button>
                    <button
                      onClick={() => handlePermanentDeleteBook(book.id)}
                      disabled={isDeleting}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                        permDeleteConfirmId === book.id 
                          ? 'bg-red-700 text-white animate-pulse' 
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {permDeleteConfirmId === book.id ? "Sure?" : "Delete Forever"}
                    </button>
                  </div>
                </div>
              ))}
              {filteredDeletedBooks.length === 0 && (
                <div className="p-8 text-center text-zinc-400 text-xs font-bold">রিসাইকেল বিন খালি</div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'referrals' && (
          <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="text-emerald-500" size={20} />
                  <h2 className="text-lg font-black tracking-tight">রেফারেল তালিকা (Referrals)</h2>
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{referrals.length} Referrals</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="text"
                  placeholder="রেফারার বা রেফার করা ইউজার খুঁজুন..."
                  value={referralSearch}
                  onChange={(e) => setReferralSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[500px] overflow-y-auto">
              <div className="grid grid-cols-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <div>Referrer (কে রেফার করেছে)</div>
                <div>Referee (যাকে রেফার করেছে)</div>
                <div>Date (তারিখ)</div>
              </div>
              {filteredReferrals.map((ref, idx) => (
                <div key={idx} className="grid grid-cols-3 p-3 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 text-[10px]">
                      {(ref.referrer_username || 'U')[0].toUpperCase()}
                    </div>
                    <span>{ref.referrer_username || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-[10px]">
                      {(ref.referee_username || 'U')[0].toUpperCase()}
                    </div>
                    <span>{ref.referee_username || 'Unknown'}</span>
                  </div>
                  <div className="text-zinc-400 text-[10px]">
                    {safeDate(ref.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {filteredReferrals.length === 0 && (
                <div className="p-8 text-center text-zinc-400 text-xs font-bold">কোন রেফারেল পাওয়া যায়নি</div>
              )}
            </div>
          </section>
        )}

        {/* Footer Branding */}
        <footer className="py-8 text-center opacity-30 text-[8px] font-black tracking-[0.3em] uppercase">
          DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
        </footer>

        {/* User Notes Modal */}
        <AnimatePresence>
          {showNotesModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNotesModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-black/5 dark:border-white/5 overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="p-8 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-amber-50/30 dark:bg-amber-900/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500 text-white rounded-xl">
                      <Edit3 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">User Notes</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Viewing all notes for this user</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowNotesModal(false)}
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                  {loadingNotes ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Loading Notes...</p>
                    </div>
                  ) : userNotes.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText size={48} className="mx-auto text-zinc-200 mb-4" />
                      <p className="text-zinc-400 font-bold">No notes found for this user.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {userNotes.map((note) => (
                        <div key={note.id} className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-black/5 dark:border-white/5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-black text-lg">{note.title}</h4>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                              {safeDate(note.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* User Detail Modal */}
        <AnimatePresence>
          {selectedUser && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-white/10 overflow-hidden relative"
              >
                <button 
                  onClick={() => setSelectedUser(null)} 
                  className="absolute top-6 right-6 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors z-10"
                >
                  <X size={24} />
                </button>

                <div className="text-center space-y-6">
                  <div className="relative inline-block">
                    <div className="w-32 h-32 rounded-full border-4 border-emerald-500/20 p-1 overflow-hidden mx-auto">
                      <img 
                        src={selectedUser.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`} 
                        alt="" 
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-white dark:border-zinc-900 ${selectedUser.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{selectedUser.fullName || selectedUser.username}</h2>
                    <p className="text-zinc-500 font-bold">@{selectedUser.username}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-left">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Email Address</div>
                      <div className="font-bold flex items-center gap-2">
                        <Mail size={14} className="text-zinc-400" />
                        {selectedUser.email || "Not provided"}
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Device Information</div>
                      <div className="font-bold flex items-center gap-2">
                        <Settings size={14} className="text-zinc-400" />
                        <span className="truncate">{selectedUser.device_id || "Unknown Device"}</span>
                      </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">User Notepad</div>
                        <button 
                          onClick={() => {
                            setSelectedUser(null);
                            fetchUserNotes(selectedUser.id);
                          }}
                          className="text-[10px] font-black text-amber-600 uppercase tracking-widest hover:underline"
                        >
                          View All ({selectedUser.notes_count || 0})
                        </button>
                      </div>
                      <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap italic line-clamp-3">
                        {selectedUser.notes || "No notes written yet."}
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Account Stats</div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 font-bold">
                          <History size={14} className="text-zinc-400" />
                          Books Read: {selectedUser.booksReadCount || 0}
                        </div>
                        <div className="text-[10px] font-black px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg uppercase">
                          {selectedUser.role}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Close Profile
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Action Button for Adding Books */}
        {activeTab === 'books' && !showForm && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { resetForm(); setShowForm(true); }}
            className="fixed bottom-24 right-6 w-16 h-16 bg-emerald-500 text-white rounded-full shadow-2xl flex items-center justify-center z-40"
          >
            <PlusCircle size={32} />
          </motion.button>
        )}

        {/* Add/Edit Book Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                      {editingBookId ? <Edit2 size={20} /> : <PlusCircle size={20} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">{editingBookId ? 'বই এডিট করুন' : 'নতুন বই যোগ করুন'}</h3>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Book Management System</p>
                    </div>
                  </div>
                  <button onClick={resetForm} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSaveBook} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Step 1: Cover Image</div>
                      <div className="aspect-[3/4] border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group" onClick={() => fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                        {imagePreview ? (
                          <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                        ) : (
                          <div className="text-center p-4">
                            <ImageIcon className="mx-auto text-zinc-300 mb-2" size={32} />
                            <p className="text-[10px] font-bold text-zinc-400">গ্যালারি থেকে ফটো যোগ করুন</p>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ImageIcon className="text-white" size={24} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Step 2: Book Details</div>
                      <div className="space-y-4">
                        <div className="relative">
                          <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                          <input
                            type="text"
                            required
                            placeholder="বইয়ের নাম"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                          />
                        </div>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                          <input
                            type="text"
                            required
                            placeholder="লেখকের নাম"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                          />
                        </div>
                        <div className="relative">
                          <File className="absolute left-3 top-3 text-zinc-400" size={16} />
                          <textarea
                            placeholder="বই লেখক এর তথ্য (Description)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                          />
                        </div>
                        <div className="relative">
                          <File className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                          <input
                            type="text"
                            placeholder="ফাইল লিঙ্ক (ঐচ্ছিক)"
                            value={pdfUrl}
                            onChange={(e) => setPdfUrl(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                          />
                        </div>
                        <div className="relative">
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full pl-4 pr-10 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold appearance-none"
                          >
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">বইয়ের পৃষ্ঠা সমূহ (Pages)</label>
                            <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => {
                                  handleConfirm('আপনি কি সব পৃষ্ঠা মুছে ফেলতে চান?', () => {
                                    setPages(['']);
                                  });
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center gap-1 hover:underline"
                              >
                                <Trash2 size={12} />
                                সব মুছে ফেলুন
                              </button>
                              <button 
                                type="button"
                                onClick={() => setShowBulkImport(!showBulkImport)}
                                className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1 hover:underline"
                              >
                                <FileText size={12} />
                                একবারে সব যোগ করুন
                              </button>
                              <button 
                                type="button"
                                onClick={() => setPages([...pages, ''])}
                                className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1 hover:underline"
                              >
                                <PlusCircle size={12} />
                                নতুন পৃষ্ঠা যোগ করুন
                              </button>
                            </div>
                          </div>

                          {showBulkImport && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-3 animate-in fade-in slide-in-from-top-2">
                              <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Bulk Import Mode</div>
                              <p className="text-[10px] text-zinc-500 font-medium">
                                এখানে পুরো বইয়ের লেখা পেস্ট করুন। পৃষ্ঠা আলাদা করতে লেখার মাঝে শুধু সংখ্যা (যেমন: <b>১</b>, <b>২</b>) অথবা <b>Page 1</b>, <b>পৃষ্ঠা ১</b> লিখে দিন।
                              </p>
                              <textarea
                                rows={8}
                                value={bulkText}
                                onChange={(e) => setBulkText(e.target.value)}
                                placeholder="এখানে সব লেখা পেস্ট করুন..."
                                className="w-full p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleBulkImport}
                                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20"
                                >
                                  পৃষ্ঠাগুলো আলাদা করুন
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowBulkImport(false)}
                                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                >
                                  বাতিল
                                </button>
                              </div>
                            </div>
                          )}
                          
                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {pages.map((page, index) => (
                              <div key={index} className="space-y-2 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-black/5 dark:border-white/5 relative group">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">পৃষ্ঠা {index + 1}</span>
                                  {pages.length > 1 && (
                                    <button 
                                      type="button"
                                      onClick={() => setPages(pages.filter((_, i) => i !== index))}
                                      className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                                <textarea
                                  required
                                  rows={4}
                                  placeholder={`পৃষ্ঠা ${index + 1} এর লেখা...`}
                                  value={page}
                                  onChange={(e) => {
                                    const newPages = [...pages];
                                    newPages[index] = e.target.value;
                                    setPages(newPages);
                                  }}
                                  className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-black uppercase tracking-widest transition-all"
                    >
                      বাতিল
                    </button>
                    {editingBookId && (
                      <button
                        type="button"
                        onClick={() => {
                          const book = books.find(b => b.id === editingBookId);
                          if (book) {
                            handleDeleteBook(book);
                            resetForm();
                          }
                        }}
                        className="flex-1 py-4 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={18} />
                        মুছে ফেলুন
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
                    >
                      <Save size={18} />
                      {editingBookId ? 'আপডেট করুন' : 'সেভ করুন'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {/* Password Edit Modal */}
        {editingPasswordUserId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black tracking-tight">পাসওয়ার্ড এডিট</h3>
                  <button onClick={() => setEditingPasswordUserId(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">নতুন পাসওয়ার্ড</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-bold"
                    placeholder="নতুন পাসওয়ার্ড..."
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingPasswordUserId(null)}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-black uppercase tracking-widest transition-all"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleUpdatePassword}
                    className="flex-1 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg"
                  >
                    সেভ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Book Order Modal */}
        {editingOrderBookId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpNarrowWide className="text-amber-500" size={20} />
                    <h3 className="text-xl font-black tracking-tight">বইয়ের সিরিয়াল সেট করুন</h3>
                  </div>
                  <button onClick={() => setEditingOrderBookId(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">সিরিয়াল নম্বর (যেমন: ১, ২, ৩...)</label>
                  <input
                    type="number"
                    value={newOrderIndex}
                    onChange={(e) => setNewOrderIndex(parseInt(e.target.value) || 0)}
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-bold"
                    placeholder="সিরিয়াল নম্বর..."
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingOrderBookId(null)}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-black uppercase tracking-widest transition-all"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleUpdateOrder}
                    className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg"
                  >
                    সেভ করুন
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
                toast.type === 'success' 
                  ? 'bg-emerald-500 text-white border-emerald-400' 
                  : 'bg-rose-500 text-white border-rose-400'
              }`}
            >
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
              </div>
              <span className="text-sm font-bold">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Confirm Modal */}
        <AnimatePresence>
          {confirmConfig && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5"
              >
                <div className="p-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
                    <AlertCircle size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black tracking-tight">আপনি কি নিশ্চিত?</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-bold">{confirmConfig.message}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setConfirmConfig(null)}
                      className="py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      না
                    </button>
                    <button
                      onClick={() => {
                        confirmConfig.onConfirm();
                        setConfirmConfig(null);
                      }}
                      className="py-4 rounded-2xl bg-red-600 text-white text-sm font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                    >
                      হ্যাঁ
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};


