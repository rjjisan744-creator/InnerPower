import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Copy, Check, Send, Phone, ShieldCheck, X, MessageSquare } from 'lucide-react';
import { User } from './types';
import { SupportContactModal } from './components/SupportContactModal';

interface SubscriptionOverlayProps {
  user: User;
  onClose?: () => void;
}

export const SubscriptionOverlay: React.FC<SubscriptionOverlayProps> = ({ user, onClose }) => {
  const [bkashNumber, setBkashNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(user.hasPendingSubscription || false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const BKASH_TARGET = "01613071344";
  const AMOUNT = 100;
  const DURATION = "১ বছর";

  const handleCopy = () => {
    navigator.clipboard.writeText(BKASH_TARGET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bkashNumber || !transactionId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/subscriptions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: AMOUNT,
          bkashNumber, // This will now store the last digit(s)
          transactionId
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.message || 'পেমেন্ট রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে');
      }
    } catch (error) {
      console.error('Error submitting subscription:', error);
      setError('সার্ভারের সাথে সংযোগ করা যাচ্ছে না।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5 my-auto relative"
      >
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-500 transition-all z-10"
          >
            <X size={20} />
          </button>
        )}
        {!submitted ? (
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mx-auto text-rose-600 mb-4">
                <CreditCard size={32} />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-red-600">ফ্রি ব্যবহারের সীমা শেষ হয়েছে।</h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-sm font-bold">
                মাত্র ১০০ টাকায় ১ বছরের প্রিমিয়াম সাবস্ক্রিপশন চালু করুন।
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-2xl text-xs font-bold text-center animate-in fade-in zoom-in duration-200">
                {error}
              </div>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl p-6 border border-black/5 dark:border-white/5 space-y-4">
              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">পেমেন্ট (বিকাশ)</div>
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/20 rounded-xl flex items-center justify-center text-pink-600 font-black text-xs">bKash</div>
                    <div>
                      <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">বিকাশ নাম্বার (Personal)</div>
                      <div className="text-sm font-black tracking-wider">{BKASH_TARGET}</div>
                    </div>
                  </div>
                  <button 
                    onClick={handleCopy}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  >
                    {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
              
              <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed">
                📌 পেমেন্ট সম্পন্ন করার পর আপনার Transaction ID এবং যেই নাম্বার থেকে টাকা পাঠানো হয়েছে, সেই নাম্বারের শেষ সংখ্যাটি নিচের ফর্মে প্রদান করে সাবমিট করুন।
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Transaction ID</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="TRX12345678"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm outline-none focus:ring-2 focus:ring-rose-500 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">নাম্বারের শেষ সংখ্যাটি</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="যেমন: 5"
                    value={bkashNumber}
                    onChange={(e) => setBkashNumber(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm outline-none focus:ring-2 focus:ring-rose-500 transition-all font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'প্রসেসিং হচ্ছে...' : (
                  <>
                    <Send size={18} />
                    সাবমিট করুন
                  </>
                )}
              </button>
            </form>

            <div className="text-center space-y-3">
              <a 
                href="https://wa.me/8801990608143" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
              >
                <MessageSquare size={14} />
                সাপোর্টের জন্য হোয়াটসঅ্যাপ করুন
              </a>
              <div className="flex justify-center">
                <button 
                  onClick={() => setShowSupportModal(true)}
                  className="inline-flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-widest hover:underline"
                >
                  <MessageSquare size={14} />
                  লাইভ চ্যাট (Live Support)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <Check size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight">রিকোয়েস্ট সফল!</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                আপনার পেমেন্ট রিকোয়েস্টটি এডমিনের কাছে পাঠানো হয়েছে। ভেরিফিকেশন শেষ হলে আপনার অ্যাকাউন্টটি ১ বছরের জন্য একটিভ হয়ে যাবে। অনুগ্রহ করে অপেক্ষা করুন।
              </p>
            </div>
            <div className="space-y-4">
              <button
                onClick={() => {
                  if (onClose) onClose();
                  else window.location.reload();
                }}
                className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
              >
                ঠিক আছে
              </button>
              <button 
                onClick={() => setShowSupportModal(true)}
                className="w-full py-3 bg-rose-50 dark:bg-rose-900/10 text-rose-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare size={14} />
                সাপোর্ট চ্যাট
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <SupportContactModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        userId={user.id}
        username={user.username}
      />
    </div>
  );
};
