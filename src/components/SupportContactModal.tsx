import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, CheckCircle2, User, Shield } from 'lucide-react';

interface Message {
  id: number;
  user_id: number | string;
  username: string;
  sender_role: 'user' | 'admin';
  message: string;
  status: string;
  created_at: string;
}

interface SupportContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number | string;
  username?: string;
}

export const SupportContactModal: React.FC<SupportContactModalProps> = ({ isOpen, onClose, userId, username }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = React.useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/support/messages/${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, userId, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !userId) return;

    const currentMessage = message.trim();
    setMessage('');
    setIsSending(true);
    setError('');

    try {
      const res = await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username: username || 'Guest',
          message: currentMessage,
          sender_role: 'user'
        }),
      });

      const data = await res.json();
      if (data.success) {
        fetchMessages();
      } else {
        setError(data.message || 'মেসেজ পাঠানো যায়নি।');
        setMessage(currentMessage);
      }
    } catch (err) {
      setError('সার্ভারের সাথে সংযোগ করা যাচ্ছে না।');
      setMessage(currentMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-zinc-900 w-full max-w-md h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5 flex flex-col relative"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight">সাপোর্ট চ্যাট</h2>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live Support Active</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/20">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                    <MessageSquare size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold">আপনার সমস্যাটি এখানে লিখুন</p>
                    <p className="text-[10px] font-medium">এডমিন শীঘ্রই রিপ্লাই দেবেন</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] space-y-1`}>
                      <div className={`flex items-center gap-1.5 mb-1 ${msg.sender_role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`p-1 rounded-md ${msg.sender_role === 'user' ? 'bg-zinc-200 dark:bg-zinc-800' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'}`}>
                          {msg.sender_role === 'user' ? <User size={10} /> : <Shield size={10} />}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                          {msg.sender_role === 'user' ? 'You' : 'Admin'}
                        </span>
                      </div>
                      <div
                        className={`p-4 rounded-2xl text-sm font-medium shadow-sm ${
                          msg.sender_role === 'user'
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-tr-none'
                            : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-none border border-black/5 dark:border-white/5'
                        }`}
                      >
                        {msg.message}
                      </div>
                      <p className={`text-[8px] font-bold text-zinc-400 ${msg.sender_role === 'user' ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="মেসেজ লিখুন..."
                  className="w-full pl-5 pr-14 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm outline-none focus:ring-2 focus:ring-rose-500 transition-all font-medium resize-none h-14"
                />
                <button
                  type="submit"
                  disabled={isSending || !message.trim()}
                  className="absolute right-2 top-2 bottom-2 w-10 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-rose-500/20"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </form>
              {error && (
                <p className="mt-2 text-[10px] font-bold text-rose-500 text-center">{error}</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
