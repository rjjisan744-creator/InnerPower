import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, MessageSquare, LogOut, Phone, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SupportContactModal } from './components/SupportContactModal';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export const PendingActivationPage: React.FC = () => {
  const navigate = useNavigate();
  const [smsSupportNumber, setSmsSupportNumber] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  const getDeviceId = () => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'web-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          setSmsSupportNumber(settingsDoc.data().sms_support_number || '');
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl border border-black/5 dark:border-white/5 text-center space-y-8"
      >
        <div className="relative">
          <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center mx-auto text-amber-600 animate-pulse">
            <Clock size={48} />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center shadow-lg border border-black/5 dark:border-white/5">
            <div className="w-4 h-4 bg-amber-500 rounded-full animate-ping" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">অপেক্ষা করুন</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold leading-relaxed">
            আপনার অ্যাকাউন্টটি বর্তমানে ভেরিফিকেশনের জন্য অপেক্ষমান আছে। এডমিন আপনার তথ্য যাচাই করে অ্যাকাউন্টটি একটিভ করে দেবেন।
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-6 rounded-3xl space-y-4">
          <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">জরুরী প্রয়োজনে যোগাযোগ করুন</p>
          <div className="grid grid-cols-2 gap-3">
            <a 
              href={`https://wa.me/88${smsSupportNumber || '01990608143'}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-zinc-800 rounded-2xl text-emerald-600 text-sm font-black shadow-sm hover:shadow-md transition-all"
            >
              <MessageSquare size={18} />
              WhatsApp
            </a>
            <a 
              href={`imo://chat?phone=88${smsSupportNumber || '01990608143'}`} 
              className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-300 text-sm font-black shadow-sm hover:shadow-md transition-all"
            >
              <MessageSquare size={18} />
              imo
            </a>
          </div>
          <button 
            onClick={() => setShowSupportModal(true)}
            className="w-full flex items-center justify-center gap-3 py-4 bg-rose-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-rose-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <MessageSquare size={20} />
            লাইভ সাপোর্ট চ্যাট (Live Chat)
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 mx-auto text-zinc-400 hover:text-red-500 font-black text-[10px] uppercase tracking-widest transition-colors"
        >
          <LogOut size={14} />
          অন্য অ্যাকাউন্ট দিয়ে লগইন করুন
        </button>
      </motion.div>

      <SupportContactModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        userId={user.id || getDeviceId()}
        username={user.username || 'Guest'}
      />
    </div>
  );
};
