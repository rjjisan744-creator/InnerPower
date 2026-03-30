import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Theme } from './types';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    app_name: 'InnerPower',
    sub_title: 'Book Library - What will you learn from these books?',
    home: 'Home',
    books: 'Books',
    trial_banner: '3 Days Free Trial',
    branding: 'DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA',
    login: 'Login',
    register: 'Register',
    username: 'Username',
    password: 'Password',
    logout: 'Logout',
    admin_panel: 'RJ Jisan',
    enter_master_pass: 'Enter Master Password',
    access_denied: 'Access Denied',
    pending_activation: 'Your account is pending activation by Admin.',
    trial_expired: 'Your trial has expired. Please pay 100 BDT to continue.',
    payment_required: 'Payment Required',
    active: 'Active',
    blocked: 'Blocked',
    pending: 'Pending',
    activate: 'Activate',
    block: 'Block',
    users: 'Users',
    add_book: 'Add Book',
    title: 'Title',
    cover_url: 'Cover URL',
    pages_urls: 'Pages URLs (one per line)',
    submit: 'Submit',
    reading: 'Reading',
    next: 'Next',
    prev: 'Previous',
    page: 'Page',
    motivational_text: `These books in this library are not just for reading, but for rebuilding yourself anew.
Here you can learn:
• To understand human behavior and thoughts
• To catch others' plans in advance
• To build influential communication and leadership skills
• Strategies to earn respect from people
• Ways to avoid insults while maintaining self-respect
• To improve your hidden inner strength and skills
These books have given birth to discussed, criticized, and powerful thoughts worldwide.
Those who do not want to remain ordinary use this knowledge to become extraordinary.
Start reading today - create your new version.`,
  },
  bn: {
    app_name: 'InnerPower',
    sub_title: 'বই লাইব্রেরী - বইগুলো পড়ে কি শিখবেন?',
    home: 'হোম',
    books: 'বইসমূহ',
    trial_banner: '৩ দিন Free ট্রায়াল',
    branding: 'DEVELOPED BY RJ JISAN | FORUM JESSORE JHIKARGACHA',
    login: 'লগইন',
    register: 'রেজিস্ট্রেশন',
    username: 'ইউজারনেম',
    password: 'পাসওয়ার্ড',
    logout: 'লগআউট',
    admin_panel: 'RJ Jisan',
    enter_master_pass: 'মাস্টার পাসওয়ার্ড দিন',
    access_denied: 'প্রবেশাধিকার অস্বীকার করা হয়েছে',
    pending_activation: 'আপনার অ্যাকাউন্টটি অ্যাডমিন দ্বারা অ্যাক্টিভেশনের অপেক্ষায় আছে।',
    trial_expired: 'আপনার ট্রায়াল শেষ হয়েছে। চালিয়ে যেতে ১০০ টাকা পেমেন্ট করুন।',
    payment_required: 'পেমেন্ট প্রয়োজন',
    active: 'সক্রিয়',
    blocked: 'ব্লকড',
    pending: 'পেন্ডিং',
    activate: 'সক্রিয় করুন',
    block: 'ব্লক করুন',
    users: 'ব্যবহারকারী',
    add_book: 'বই যোগ করুন',
    title: 'শিরোনাম',
    cover_url: 'কভার ইউআরএল',
    pages_urls: 'পেজ ইউআরএল (প্রতি লাইনে একটি)',
    submit: 'জমা দিন',
    reading: 'পড়া হচ্ছে',
    next: 'পরবর্তী',
    prev: 'পূর্ববর্তী',
    page: 'পৃষ্ঠা',
    motivational_text: `এই লাইব্রেরির বইগুলো শুধু পড়ার জন্য নয় নিজেকে নতুনভাবে গড়ার জন্য।
এখানে আপনি শিখতে পারবেন:
• মানুষের আচরণ ও চিন্তা বুঝতে
• অন্যের পরিকল্পনা আগেভাগে ধরতে
• প্রভাবশালী যোগাযোগ ও নেতৃত্ব দক্ষতা গড়ে তুলতে
• মানুষের কাছ থেকে সম্মান অর্জনের কৌশল
• আত্মসম্মান বজায় রেখে অপমান এড়িয়ে চলার উপায়
• নিজের ভিতরের লুকানো শক্তি ও স্কিল উন্নত করতে
এই বইগুলো বিশ্বজুড়ে আলোচিত, সমালোচিত এবং শক্তিশালী চিন্তার জন্ম দিয়েছে।
যারা সাধারণ থাকতে চায় না তারাই এই জ্ঞান ব্যবহার করে অসাধারণ হয়ে ওঠে।
আজ পড়া শুরু করুন- আপনার নতুন সংস্করণ তৈরি করুন।`,
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'bn');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <AppContext.Provider value={{ language, setLanguage, theme, setTheme, t }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
