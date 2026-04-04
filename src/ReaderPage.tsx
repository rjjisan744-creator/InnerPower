import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useApp } from './AppContext';
import { Book, User } from './types';
import { Home, ChevronLeft, ChevronRight, File } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommentBox } from './components/CommentBox';
import { SubscriptionOverlay } from './SubscriptionOverlay';
import { db, auth } from './firebase';
import { 
  doc, 
  getDoc, 
  onSnapshot, 
  addDoc, 
  collection, 
  serverTimestamp 
} from 'firebase/firestore';

export const ReaderPage: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const pageParam = queryParams.get('page');
  
  const [book, setBook] = useState<Book | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(pageParam ? parseInt(pageParam) : 1);
  const [pages, setPages] = useState<string[]>([]);
  const { t } = useApp();
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
    const p = new URLSearchParams(location.search).get('page');
    if (p) {
      setCurrentPage(parseInt(p));
    }
  }, [location.search]);

  useEffect(() => {
    if (book) {
      try {
        const parsedPages = JSON.parse(book.content);
        if (Array.isArray(parsedPages)) {
          setPages(parsedPages);
        } else {
          setPages([book.content]);
        }
      } catch (e) {
        // Fallback for old books or non-JSON content
        const content = book.content;
        const chunkSize = 1500;
        const chunks: string[] = [];
        
        for (let i = 0; i < content.length; i += chunkSize) {
          chunks.push(content.substring(i, i + chunkSize));
        }
        setPages(chunks);
      }
    }
  }, [book]);

  useEffect(() => {
    if (id && currentPage > 0) {
      localStorage.setItem(`last_page_${id}`, currentPage.toString());
    }
  }, [id, currentPage]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/auth');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    
    // Real-time listeners
    const unsubscribeAuth = auth.onAuthStateChanged((firebaseUser) => {
      if (!firebaseUser) {
        console.log("ReaderPage: No firebase user, redirecting to auth");
        navigate('/auth');
        return;
      }

      console.log("ReaderPage: Auth ready, setting up listeners for", firebaseUser.uid);

      // Verify status with Firestore
      const unsubUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'blocked') {
            localStorage.removeItem('user');
            navigate('/auth', { state: { error: "আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে। দয়া করে অ্যাডমিনের সাথে যোগাযোগ করুন।" } });
            return;
          }
          
          const now = new Date();
          const trialEnds = data.trial_ends_at ? safeDate(data.trial_ends_at) : new Date(0);
          const isTrialExpired = now > trialEnds;

          const updatedUser = {
            ...parsedUser,
            ...data,
            id: docSnap.id,
            isTrialExpired
          };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));

          const isExpired = isTrialExpired && !data.is_paid;

          if (data.status === 'blocked' || isExpired) {
            navigate('/');
          }
        } else {
          localStorage.removeItem('user');
          navigate('/auth');
        }
      }, (err) => {
        console.error("ReaderPage: User listener error:", err);
      });

      let unsubBook = () => {};
      if (id) {
        unsubBook = onSnapshot(doc(db, 'books', id), (docSnap) => {
          if (docSnap.exists()) {
            setBook({ id: docSnap.id, ...docSnap.data() } as any);
          }
        }, (err) => {
          console.error("ReaderPage: Book listener error:", err);
        });

        // Add to reading history only once per session per book to save quota
        const sessionKey = `read_${id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          addDoc(collection(db, 'reading_history'), {
            user_id: firebaseUser.uid,
            book_id: id,
            read_at: serverTimestamp()
          }).then(() => {
            sessionStorage.setItem(sessionKey, 'true');
          }).catch(err => {
            if (err.code !== 'resource-exhausted') {
              console.error("ReaderPage: History error:", err);
            }
          });
        }
      }

      return () => {
        unsubUser();
        unsubBook();
      };
    });

    // Secure Screen: Disable right click and selection
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      unsubscribeAuth();
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  if (!book) return null;

  const isTrialExpired = user?.trialEndsAt ? safeDate(user.trialEndsAt) < new Date() : user?.isTrialExpired;

  // If trial expired and not paid, show only the overlay
  if (user && isTrialExpired && !user.isPaid) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-zinc-950">
        <SubscriptionOverlay 
          user={user} 
          onClose={() => {
            localStorage.removeItem('user');
            navigate('/auth');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {/* Sticky Top Bar Branding */}
      <div className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-zinc-900 dark:text-white py-3 px-4 flex items-center justify-between z-50 border-b border-black/5 dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors">
            <Home size={20} />
          </button>
          <div className="flex flex-col">
            <span className="text-[7px] font-black tracking-[0.1em] uppercase opacity-60">
              DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
            </span>
            <span className="text-xs font-bold text-emerald-600">
              পৃষ্ঠা: {currentPage} / {pages.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage(prev => Math.max(1, prev - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            disabled={currentPage === pages.length}
            onClick={() => {
              setCurrentPage(prev => Math.min(pages.length, prev + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 disabled:opacity-30 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Reader Area */}
      <main className="max-w-3xl mx-auto p-6 md:p-12 pb-32">
        {(book.pdf_url || book.author || book.description) && (
          <div className="mb-8 flex justify-center">
            <Link 
              to={`/book/${book.id}/info`}
              className="inline-flex items-center gap-3 p-3 px-5 bg-white dark:bg-zinc-900 rounded-2xl border border-black/5 dark:border-white/10 shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="w-8 h-8 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <File size={16} />
              </div>
              <div className="text-left">
                <div className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">ফাইল</div>
                <div className="text-[10px] font-bold text-zinc-900 dark:text-white">
                  বই লেখক এর তথ্য
                </div>
              </div>
            </Link>
          </div>
        )}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight mb-2">{book.title}</h1>
          {book.author && (
            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">
              লেখক: {book.author}
            </p>
          )}
          <div className="h-1 w-16 bg-emerald-500 mx-auto rounded-full"></div>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30">
            পৃষ্ঠা নম্বর: {currentPage}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="prose dark:prose-invert max-w-none"
          >
            <div className="whitespace-pre-wrap leading-relaxed text-lg font-medium text-zinc-700 dark:text-zinc-300 font-serif min-h-[400px]">
              {pages[currentPage - 1]}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pagination Controls */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl p-3 px-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/10 z-50">
          <button
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage(prev => Math.max(1, prev - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-600 disabled:opacity-20 transition-all"
          >
            <ChevronLeft size={20} />
            আগের পৃষ্ঠা
          </button>
          
          <div className="flex flex-col items-center min-w-[80px]">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">পৃষ্ঠা</span>
            <span className="text-lg font-black text-emerald-600 tracking-tighter">
              {currentPage} / {pages.length}
            </span>
          </div>
          
          <button
            disabled={currentPage === pages.length}
            onClick={() => {
              setCurrentPage(prev => Math.min(pages.length, prev + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-600 disabled:opacity-20 transition-all"
          >
            পরের পৃষ্ঠা
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Reader Feedback Section */}
        {id && user && (
          <CommentBox 
            bookId={id} 
            currentUserId={user.id} 
            currentUserName={user.username} 
            isAdmin={user.role === 'admin'}
          />
        )}
      </main>

      {/* Footer Branding */}
      <footer className="py-16 text-center opacity-40 text-[10px] font-black tracking-[0.3em] uppercase">
        DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA
      </footer>

      {/* CSS to prevent screenshots/recording as much as possible */}
      <style>{`
        @media print {
          body { display: none; }
        }
        .select-none {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
      `}</style>
    </div>
  );
};
