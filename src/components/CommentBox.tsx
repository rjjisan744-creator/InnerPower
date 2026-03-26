import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, User, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Comment {
  id: number;
  user_id: number;
  username: string;
  comment: string;
  created_at: string;
}

interface CommentBoxProps {
  bookId: string;
  currentUserId: number;
  currentUserName: string;
  isAdmin?: boolean;
}

export const CommentBox: React.FC<CommentBoxProps> = ({ bookId, currentUserId, currentUserName, isAdmin = false }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/books/${bookId}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [bookId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          username: currentUserName,
          comment: newComment.trim(),
        }),
      });

      if (res.ok) {
        setNewComment('');
        fetchComments();
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!window.confirm('আপনি কি এই কমেন্টটি মুছে ফেলতে চান?')) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchComments();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mt-16 border-t border-black/5 dark:border-white/10 pt-12">
      <div className="flex items-center gap-3 mb-8 px-4">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
          <MessageSquare size={20} />
        </div>
        <h2 className="text-2xl font-black tracking-tight">পাঠক প্রতিক্রিয়া</h2>
      </div>

      {/* Comment List */}
      <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto px-4 custom-scrollbar">
        <AnimatePresence initial={false}>
          {comments.length > 0 ? (
            comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 font-bold text-xs">
                      {comment.username[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">
                      {comment.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {formatDate(comment.created_at)}
                    </span>
                    {(isAdmin || comment.user_id === currentUserId) && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                  {comment.comment}
                </p>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 text-zinc-400 font-medium italic">
              এখনো কোনো প্রতিক্রিয়া নেই। প্রথম প্রতিক্রিয়াটি আপনার হোক!
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="px-4 pb-8">
        <div className="relative">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="বইটি নিয়ে কিছু লিখুন..."
            className="w-full p-4 pr-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-medium"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};
