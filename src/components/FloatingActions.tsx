import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const FloatingActions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 items-end">
      {/* Refer Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-3 rounded-full shadow-xl shadow-emerald-500/20 border border-white/20 hover:bg-emerald-600 transition-all group"
      >
        <Share2 size={18} className="group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-black uppercase tracking-widest">রেফার করুন</span>
      </motion.button>

      {/* Support Button */}
      <motion.a
        href="https://wa.me/8801990608143"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 bg-blue-500 text-white px-5 py-3 rounded-full shadow-xl shadow-blue-500/20 border border-white/20 hover:bg-blue-600 transition-all group"
      >
        <MessageCircle size={18} className="group-hover:scale-110 transition-transform" />
        <span className="text-xs font-black uppercase tracking-widest">সাপোর্ট</span>
      </motion.a>
    </div>
  );
};
