import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book } from './types';
import { ArrowLeft, BookOpen, User, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './AppContext';

import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const BookInfoPage: React.FC = () => {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [inWishlist, setInWishlist] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const navigate = useNavigate();
  const { user } = useApp();

  useEffect(() => {
    if (!id) return;
    
    const unsub = onSnapshot(doc(db, "books", id), (docSnap) => {
      if (docSnap.exists()) {
        setBook({ id: docSnap.id, ...docSnap.data() } as unknown as Book);
      }
    });

    if (user && id) {
      const wishlistRef = doc(db, "wishlist", `${user.id}_${id}`);
      const unsubWishlist = onSnapshot(wishlistRef, (docSnap) => {
        setInWishlist(docSnap.exists());
      });
      return () => {
        unsub();
        unsubWishlist();
      };
    }

    return () => unsub();
  }, [id, user?.id]);

  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleWishlist = async () => {
    if (!user || !book || !id) return;
    setLoadingWishlist(true);
    try {
      const wishlistRef = doc(db, "wishlist", `${user.id}_${id}`);
      if (inWishlist) {
        await deleteDoc(wishlistRef);
        showToast('উইশলিস্ট থেকে সরানো হয়েছে');
      } else {
        await setDoc(wishlistRef, {
          user_id: user.id,
          book_id: id,
          created_at: new Date().toISOString()
        });
        showToast('উইশলিস্টে যোগ করা হয়েছে!');
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      showToast('সমস্যা হয়েছে, আবার চেষ্টা করুন', 'error');
    } finally {
      setLoadingWishlist(false);
    }
  };

  if (!book) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="animate-pulse text-zinc-400 font-black uppercase tracking-widest text-xs">Loading Info...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-black/5 dark:border-white/5 p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-black text-sm uppercase tracking-widest truncate">বই লেখক এর তথ্য</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 pb-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Hero Section */}
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
            <div className="w-48 h-72 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-black/5 dark:border-white/10">
              <img 
                src={book.cover_url} 
                alt={book.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight">{book.title}</h2>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30">
                      <User size={12} />
                      {book.author || 'অজানা লেখক'}
                    </div>
                    {book.category?.split(', ').map(cat => (
                      <div key={cat} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">
                        {cat === 'New book' ? 'নতুন বই' : cat}
                      </div>
                    ))}
                  </div>
              </div>
              
              <div className="flex gap-4 justify-center md:justify-start">
                <button 
                  onClick={() => navigate(`/book/${book.id}`)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  <BookOpen size={16} />
                  বইটি পড়ুন
                </button>
                <button 
                  onClick={toggleWishlist}
                  disabled={loadingWishlist}
                  className={`p-3 rounded-2xl border-2 transition-all hover:scale-110 active:scale-95 ${
                    inWishlist 
                      ? 'bg-pink-500 border-pink-500 text-white shadow-lg shadow-pink-500/20' 
                      : 'bg-white dark:bg-zinc-900 border-black/5 dark:border-white/10 text-zinc-400'
                  }`}
                >
                  <Heart size={20} fill={inWishlist ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>

          <hr className="border-black/5 dark:border-white/5" />

          {/* Description Content */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">বিস্তারিত তথ্য</h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg leading-relaxed font-medium whitespace-pre-wrap">
                {book.description || 'এই বইটির কোনো বিস্তারিত তথ্য পাওয়া যায়নি।'}
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer Branding */}
      <footer className="py-12 text-center opacity-30 text-[8px] font-black tracking-[0.3em] uppercase">
        DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
      </footer>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm ${
              toast.type === 'success' ? 'bg-zinc-900 text-white' : 'bg-red-500 text-white'
            }`}>
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
