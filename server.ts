import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'pending', -- pending, active, blocked
    is_paid BOOLEAN DEFAULT 0,
    device_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at DATETIME,
    last_login_at DATETIME,
    last_active_at DATETIME,
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    referral_code TEXT UNIQUE,
    referred_by INTEGER,
    referral_count INTEGER DEFAULT 0,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS user_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    bkash_number TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER,
    referee_id INTEGER,
    bonus_granted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(referrer_id) REFERENCES users(id),
    FOREIGN KEY(referee_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    is_locked BOOLEAN DEFAULT 0,
    password TEXT,
    sort_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    author TEXT,
    description TEXT,
    cover_url TEXT,
    content TEXT,
    category TEXT DEFAULT 'New book',
    sort_index INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    user_id INTEGER,
    username TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES books(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- NULL for global, otherwise specific user
    title TEXT,
    message TEXT,
    type TEXT DEFAULT 'info', -- info, success, warning, error
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notification_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id INTEGER,
    user_id INTEGER,
    username TEXT,
    reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(notification_id) REFERENCES notifications(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reading_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    book_id INTEGER,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    book_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(book_id) REFERENCES books(id),
    UNIQUE(user_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    username TEXT,
    sender_role TEXT DEFAULT 'user', -- 'user' or 'admin'
    message TEXT,
    status TEXT DEFAULT 'unread', -- unread, read
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Ensure columns exist for existing tables
try { db.exec("ALTER TABLE support_messages ADD COLUMN sender_role TEXT DEFAULT 'user'"); } catch (e) {}
try { db.exec("ALTER TABLE support_messages ADD COLUMN status TEXT DEFAULT 'unread'"); } catch (e) {}
try { db.exec("ALTER TABLE support_messages ADD COLUMN username TEXT"); } catch (e) {}

// Migration for support_messages user_id type and removing foreign key
try {
  const tableInfo = db.prepare("PRAGMA table_info(support_messages)").all();
  const userIdCol = tableInfo.find((col: any) => col.name === 'user_id');
  // If user_id is INTEGER or if we want to be sure it's TEXT and has no FK
  if (userIdCol) {
    console.log("Checking support_messages table schema...");
    // We'll recreate the table to be sure it has the correct TEXT type and no FK
    // SQLite doesn't easily allow dropping FKs or changing types, so RENAME/CREATE/INSERT is best
    db.exec(`
      CREATE TABLE IF NOT EXISTS support_messages_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        username TEXT,
        sender_role TEXT DEFAULT 'user',
        message TEXT,
        status TEXT DEFAULT 'unread',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Copy data if the old table exists and has data
    try {
      db.exec(`
        INSERT INTO support_messages_new (id, user_id, username, sender_role, message, status, created_at)
        SELECT id, CAST(user_id AS TEXT), username, sender_role, message, status, created_at FROM support_messages;
        DROP TABLE support_messages;
        ALTER TABLE support_messages_new RENAME TO support_messages;
      `);
      console.log("support_messages table migrated successfully.");
    } catch (e) {
      // If it fails, maybe the new table was already there or something else
      console.log("Migration skipped or already done.");
    }
  }
} catch (e) {
  console.error("Migration error:", e);
}

// Unblock users who were automatically blocked due to trial expiry
try {
  db.prepare("UPDATE users SET status = 'active' WHERE status = 'blocked' AND is_paid = 0 AND trial_ends_at < datetime('now')").run();
} catch (e) {
  console.error("Failed to unblock users on startup:", e);
}

// Migration: Add activity tracking columns if they don't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN last_login_at DATETIME");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN last_active_at DATETIME");
} catch (e) {}

// Migration: Add location columns if they don't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN latitude REAL");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN longitude REAL");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN location_name TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE referrals ADD COLUMN bonus_granted BOOLEAN DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE notifications ADD COLUMN user_id INTEGER");
} catch (e) {}

// Migration: Add category to books if it doesn't exist
try {
  db.exec("ALTER TABLE books ADD COLUMN category TEXT DEFAULT 'New book'");
} catch (e) {}

// Migration: Add content to books if it doesn't exist
try {
  db.exec("ALTER TABLE books ADD COLUMN content TEXT");
} catch (e) {}

// Migration: Add is_deleted to books if it doesn't exist
try {
  db.exec("ALTER TABLE books ADD COLUMN is_deleted BOOLEAN DEFAULT 0");
} catch (e) {}

// Ensure existing rows have 0 instead of NULL for is_deleted
try {
  db.prepare("UPDATE books SET is_deleted = 0 WHERE is_deleted IS NULL").run();
} catch (e) {}

// Migration: Add password to categories if it doesn't exist
try {
  db.exec("ALTER TABLE categories ADD COLUMN password TEXT");
} catch (e) {}

// Migration: Add sort_index to books if it doesn't exist
try {
  db.exec("ALTER TABLE books ADD COLUMN sort_index INTEGER DEFAULT 0");
} catch (e) {}

// Migration: Add pdf_url to books if it doesn't exist
try {
  db.exec("ALTER TABLE books ADD COLUMN pdf_url TEXT");
} catch (e) {}

// Migration: Add profile fields to users if they don't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN full_name TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN profile_picture TEXT");
} catch (e) {}

// Migration: Add is_paid if it doesn't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN is_paid BOOLEAN DEFAULT 0");
} catch (e) {
  // Column already exists
}

// Migration: Add device_id if it doesn't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN device_id TEXT");
} catch (e) {
  // Column already exists
}
try {
  db.exec("ALTER TABLE users ADD COLUMN notes TEXT");
} catch (e) {}

// Seed initial categories if table is empty
try {
  const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get().count;
  if (categoryCount === 0) {
    const initialCategories = [
      "New book",
      "উপন্যাস",
      "Trending",
      "Love Story",
      "Golpo",
      "Rohosso"
    ];
    const insert = db.prepare("INSERT INTO categories (name, sort_index) VALUES (?, ?)");
    initialCategories.forEach((name, index) => {
      insert.run(name, index);
    });
  }
} catch (e) {
  console.error("Failed to seed categories:", e);
}

// Seed Admin if not exists
try {
  const admin = db.prepare("SELECT * FROM users WHERE username = ?").get("jisanjisan744@gmail.com");
  if (!admin) {
    const trialEnds = new Date();
    trialEnds.setFullYear(trialEnds.getFullYear() + 100);
    db.prepare("INSERT INTO users (username, password, role, status, trial_ends_at) VALUES (?, ?, ?, ?, ?)").run(
      "jisanjisan744@gmail.com",
      "445566",
      "admin",
      "active",
      trialEnds.toISOString()
    );
  }
} catch (e) {
  console.error("Failed to seed admin:", e);
}

const app = express();

// Request Logger Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), database: "connected" });
});

const PORT = 3000;

// Migration: Add referral columns if they don't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN referred_by INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN referral_count INTEGER DEFAULT 0");
} catch (e) {}

// Helper to generate unique referral code
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Category Routes
app.get("/api/categories", (req, res) => {
  const categories = db.prepare("SELECT * FROM categories ORDER BY sort_index ASC").all();
  const lockAll = db.prepare("SELECT value FROM settings WHERE key = ?").get("lock_all_categories")?.value === "true";
  res.json({ categories, lockAll });
});

app.post("/api/admin/categories", (req, res) => {
  const { name } = req.body;
  try {
    const maxSort = db.prepare("SELECT MAX(sort_index) as maxSort FROM categories").get().maxSort || 0;
    db.prepare("INSERT INTO categories (name, sort_index) VALUES (?, ?)").run(name, maxSort + 1);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: "Category already exists" });
  }
});

app.put("/api/admin/categories/:id", (req, res) => {
  const { id } = req.params;
  const { name, is_locked, password, sort_index } = req.body;
  db.prepare("UPDATE categories SET name = COALESCE(?, name), is_locked = COALESCE(?, is_locked), password = COALESCE(?, password), sort_index = COALESCE(?, sort_index) WHERE id = ?")
    .run(name, is_locked === undefined ? null : (is_locked ? 1 : 0), password === undefined ? null : password, sort_index, id);
  res.json({ success: true });
});

app.delete("/api/admin/categories/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  res.json({ success: true });
});

app.post("/api/admin/settings/lock-categories", (req, res) => {
  const { lockAll } = req.body;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run("lock_all_categories", lockAll ? "true" : "false");
  res.json({ success: true });
});

// Auth Routes
app.get("/api/auth/check-username", (req, res) => {
  const { username } = req.query;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: "Username is required" });
  }

  const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  
  if (!existingUser) {
    return res.json({ available: true });
  }

  // Generate suggestions
  const suggestions: string[] = [];
  const base = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffixes = [
    Math.floor(Math.random() * 100).toString(),
    Math.floor(Math.random() * 1000).toString(),
    "official",
    "pro",
    "user"
  ];

  for (const suffix of suffixes) {
    const suggested = `${base}${suffix}`;
    const taken = db.prepare("SELECT id FROM users WHERE username = ?").get(suggested);
    if (!taken) {
      suggestions.push(suggested);
    }
    if (suggestions.length >= 3) break;
  }

  res.json({ available: false, suggestions });
});

app.post("/api/auth/register", (req, res) => {
  try {
    const { username, password, referralCode } = req.body;
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 3);
    
    const myReferralCode = generateReferralCode();
    
    db.transaction(() => {
      // Insert new user
      const result = db.prepare("INSERT INTO users (username, password, trial_ends_at, referral_code) VALUES (?, ?, ?, ?)").run(
        username,
        password,
        trialEnds.toISOString(),
        myReferralCode
      );
      
      const newUserId = result.lastInsertRowid;

      // Handle referral if code provided
      if (referralCode) {
        const referrer = db.prepare("SELECT * FROM users WHERE referral_code = ?").get(referralCode);
        
        if (referrer && referrer.referral_count < 10) {
          // Increment total referral count
          db.prepare("UPDATE users SET referral_count = referral_count + 1 WHERE id = ?").run(referrer.id);

          // Record the referral (bonus_granted = 0 by default)
          db.prepare("INSERT INTO referrals (referrer_id, referee_id) VALUES (?, ?)").run(
            referrer.id,
            newUserId
          );
          
          // Update new user: set who referred them
          db.prepare("UPDATE users SET referred_by = ? WHERE id = ?").run(
            referrer.id,
            newUserId
          );

          // Give the new user 6 days trial instead of 3 (3 default + 3 bonus)
          // They will still be 'pending' so they can't use it yet
          const newUserTrialEnds = new Date();
          newUserTrialEnds.setDate(newUserTrialEnds.getDate() + 6);
          db.prepare("UPDATE users SET trial_ends_at = ? WHERE id = ?").run(
            newUserTrialEnds.toISOString(),
            newUserId
          );
        }
      }
    })();

    res.json({ success: true, message: "Registration successful. Wait for admin activation." });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(400).json({ success: false, message: "Username already exists or error occurred." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password, deviceId } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    
    if (!user) {
      return res.status(401).json({ success: false, message: "এই ইউজার দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।" });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: "আপনার পাসওয়ার্ডটি ভুল। সঠিক পাসওয়ার্ড দিয়ে চেষ্টা করুন অথবা সাপোর্টে যোগাযোগ করুন: 01990608143" });
    }

    // Update device ID and last login
    const loginTime = new Date().toISOString();
    if (deviceId) {
      db.prepare("UPDATE users SET device_id = ?, last_login_at = ?, last_active_at = ? WHERE id = ?").run(deviceId, loginTime, loginTime, user.id);
    } else {
      db.prepare("UPDATE users SET last_login_at = ?, last_active_at = ? WHERE id = ?").run(loginTime, loginTime, user.id);
    }

    const now = new Date();
    const trialEnds = user.trial_ends_at ? new Date(user.trial_ends_at) : new Date(0);
    const isTrialExpired = now > trialEnds;

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        isPaid: !!user.is_paid,
        isTrialExpired,
        trialEndsAt: user.trial_ends_at,
        fullName: user.full_name,
        email: user.email,
        profilePicture: user.profile_picture,
        referralCode: user.referral_code,
        referralCount: user.referral_count,
        referredBy: user.referred_by,
        notes: user.notes
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "সার্ভারে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।" });
  }
});

app.get("/api/auth/me/:id", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  // Update last active
  db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);

  const currentTime = new Date();
  const trialEnds = new Date(user.trial_ends_at);
  const isTrialExpired = currentTime > trialEnds;

  const referralStats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM referrals WHERE referrer_id = ? AND bonus_granted = 1) as granted_count,
      (SELECT COUNT(*) FROM referrals WHERE referrer_id = ? AND bonus_granted = 0) as pending_count
  `).get(user.id, user.id);

  const readingStats = db.prepare(`
    SELECT 
      (SELECT COUNT(DISTINCT book_id) FROM reading_history WHERE user_id = ?) as books_read_count,
      (SELECT b.title FROM books b JOIN reading_history h ON b.id = h.book_id WHERE h.user_id = ? ORDER BY h.read_at DESC LIMIT 1) as currently_reading
  `).get(user.id, user.id);

  const pendingSub = db.prepare("SELECT id FROM subscriptions WHERE user_id = ? AND status = 'pending'").get(user.id);

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    isPaid: !!user.is_paid,
    isTrialExpired,
    hasPendingSubscription: !!pendingSub,
    trialEndsAt: user.trial_ends_at,
    fullName: user.full_name,
    email: user.email,
    profilePicture: user.profile_picture,
    referralCode: user.referral_code,
    referralCount: user.referral_count,
    referredBy: user.referred_by,
    referralStats,
    booksReadCount: readingStats.books_read_count,
    currentlyReading: readingStats.currently_reading || "None",
    notes: user.notes
  });
});

app.get("/api/users/:id/referrals", (req, res) => {
  const userId = req.params.id;
  const referrals = db.prepare(`
    SELECT 
      r.id,
      r.bonus_granted,
      r.created_at,
      u.username as referee_name,
      u.status as referee_status
    FROM referrals r
    JOIN users u ON r.referee_id = u.id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
  `).all(userId);
  res.json(referrals);
});

app.post("/api/users/ping/:id", (req, res) => {
  try {
    db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/users/location/:id", (req, res) => {
  const { latitude, longitude, locationName } = req.body;
  try {
    db.prepare("UPDATE users SET latitude = ?, longitude = ?, location_name = ? WHERE id = ?").run(latitude, longitude, locationName, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.put("/api/users/:id", (req, res) => {
  const { fullName, email, profilePicture } = req.body;
  const userId = req.params.id;

  try {
    db.prepare("UPDATE users SET full_name = ?, email = ?, profile_picture = ? WHERE id = ?").run(
      fullName,
      email,
      profilePicture,
      userId
    );
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    res.json({ 
      success: true, 
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        status: updatedUser.status,
        isPaid: !!updatedUser.is_paid,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        profilePicture: updatedUser.profile_picture,
        notes: updatedUser.notes
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

app.put("/api/users/:id/notes", (req, res) => {
  const { notes } = req.body;
  const userId = req.params.id;

  try {
    db.prepare("UPDATE users SET notes = ? WHERE id = ?").run(notes, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notes" });
  }
});

// Multiple Notes API
app.get("/api/users/:id/all-notes", (req, res) => {
  try {
    const notes = db.prepare("SELECT * FROM user_notes WHERE user_id = ? ORDER BY updated_at DESC").all(req.params.id);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

app.post("/api/users/:id/all-notes", (req, res) => {
  const { title, content } = req.body;
  try {
    const result = db.prepare("INSERT INTO user_notes (user_id, title, content) VALUES (?, ?, ?)").run(req.params.id, title || 'Untitled Note', content || '');
    const newNote = db.prepare("SELECT * FROM user_notes WHERE id = ?").get(result.lastInsertRowid);
    res.json(newNote);
  } catch (error) {
    res.status(500).json({ error: "Failed to create note" });
  }
});

app.put("/api/notes/:id", (req, res) => {
  const { title, content } = req.body;
  try {
    db.prepare("UPDATE user_notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(title, content, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update note" });
  }
});

app.delete("/api/notes/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM user_notes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// Admin Routes
app.get("/api/admin/referrals", (req, res) => {
  const referrals = db.prepare(`
    SELECT 
      r.id,
      r.created_at,
      u1.username as referrer_username,
      u2.username as referee_username
    FROM referrals r
    JOIN users u1 ON r.referrer_id = u1.id
    JOIN users u2 ON r.referee_id = u2.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(referrals);
});

app.get("/api/admin/users", (req, res) => {
  const users = db.prepare(`
    SELECT u.*, 
    (SELECT COUNT(*) FROM user_notes WHERE user_id = u.id) as notes_count
    FROM users u 
    WHERE u.role != 'admin'
    ORDER BY u.created_at DESC
  `).all();
  
  const mappedUsers = users.map(user => ({
    ...user,
    isPaid: !!user.is_paid,
    trialEndsAt: user.trial_ends_at,
    isTrialExpired: user.trial_ends_at ? new Date(user.trial_ends_at) < new Date() : false
  }));
  
  res.json(mappedUsers);
});

app.delete("/api/admin/users/:id", (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/admin/users/paid", (req, res) => {
  const { userId, isPaid } = req.body;
  db.prepare("UPDATE users SET is_paid = ? WHERE id = ?").run(isPaid ? 1 : 0, userId);
  res.json({ success: true });
});

app.post("/api/admin/users/status", (req, res) => {
  const { userId, status } = req.body;
  
  db.transaction(() => {
    // Get old status
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) return;

    // Update status
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, userId);

    // If changing from pending to active, check for referral bonus
    if (user.status === 'pending' && status === 'active') {
      const referral = db.prepare("SELECT * FROM referrals WHERE referee_id = ? AND bonus_granted = 0").get(userId);
      if (referral) {
        const referrer = db.prepare("SELECT * FROM users WHERE id = ?").get(referral.referrer_id);
        if (referrer) {
          // Grant bonus to referrer
          const referrerTrialEnds = new Date(referrer.trial_ends_at);
          referrerTrialEnds.setDate(referrerTrialEnds.getDate() + 3);
          
          db.prepare("UPDATE users SET trial_ends_at = ? WHERE id = ?").run(
            referrerTrialEnds.toISOString(),
            referrer.id
          );
          
          // Mark as granted
          db.prepare("UPDATE referrals SET bonus_granted = 1 WHERE id = ?").run(referral.id);

          // Send notification to referrer
          db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)").run(
            referrer.id,
            "রেফারেল বোনাস!",
            `আপনার রেফারেল (${user.username}) একটিভ হয়েছে! আপনি ৩ দিন অতিরিক্ত ফ্রি ট্রায়াল পেয়েছেন।`,
            "success"
          );
        }
      }
    }
  })();

  res.json({ success: true });
});

app.post("/api/admin/users/password", (req, res) => {
  const { userId, password } = req.body;
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(password, userId);
  res.json({ success: true });
});

app.post("/api/admin/users/trial", (req, res) => {
  const { userId, trialEndsAt } = req.body;
  try {
    db.prepare("UPDATE users SET trial_ends_at = ? WHERE id = ?").run(trialEndsAt, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update trial date" });
  }
});

app.post("/api/admin/books", (req, res) => {
  const { title, author, description, cover_url, pdf_url, content, category } = req.body;
  const info = db.prepare("INSERT INTO books (title, author, description, cover_url, pdf_url, content, category) VALUES (?, ?, ?, ?, ?, ?, ?)").run(title, author, description, cover_url, pdf_url, content, category || 'New book');
  res.json({ success: true, bookId: info.lastInsertRowid });
});

app.put("/api/admin/books/:id", (req, res) => {
  const { title, author, description, cover_url, pdf_url, content, category } = req.body;
  db.prepare("UPDATE books SET title = ?, author = ?, description = ?, cover_url = ?, pdf_url = ?, content = ?, category = ? WHERE id = ?").run(title, author, description, cover_url, pdf_url, content, category, req.params.id);
  res.json({ success: true });
});

app.delete("/api/admin/books/:id", (req, res) => {
  const result = db.prepare("UPDATE books SET is_deleted = 1 WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, message: "বইটি পাওয়া যায়নি।" });
  }
  res.json({ success: true });
});

app.post("/api/admin/books/:id/restore", (req, res) => {
  const result = db.prepare("UPDATE books SET is_deleted = 0 WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, message: "বইটি পাওয়া যায়নি।" });
  }
  res.json({ success: true });
});

app.delete("/api/admin/books/:id/permanent", (req, res) => {
  const result = db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, message: "বইটি পাওয়া যায়নি।" });
  }
  res.json({ success: true });
});

app.post("/api/admin/books/order", (req, res) => {
  const { bookId, index } = req.body;
  db.prepare("UPDATE books SET sort_index = ? WHERE id = ?").run(index, bookId);
  res.json({ success: true });
});

app.get("/api/admin/books/deleted", (req, res) => {
  const books = db.prepare("SELECT * FROM books WHERE is_deleted = 1").all();
  res.json(books);
});

// Notification Routes
app.get("/api/notifications", (req, res) => {
  const userId = req.query.userId;
  const isAdmin = req.query.isAdmin === 'true';
  let notifications;
  
  if (isAdmin) {
    // Admin sees everything
    notifications = db.prepare("SELECT n.*, u.full_name as user_name FROM notifications n LEFT JOIN users u ON n.user_id = u.id ORDER BY n.created_at DESC LIMIT 100").all();
  } else if (userId) {
    notifications = db.prepare("SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 50").all(userId);
  } else {
    notifications = db.prepare("SELECT * FROM notifications WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50").all();
  }
  res.json(notifications);
});

app.post("/api/admin/notifications", (req, res) => {
  const { title, message, type, userId } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, message: "Title and message are required" });
  }
  db.prepare("INSERT INTO notifications (title, message, type, user_id) VALUES (?, ?, ?, ?)").run(title, message, type || 'info', userId || null);
  res.json({ success: true });
});

app.delete("/api/admin/notifications/:id", (req, res) => {
  db.prepare("DELETE FROM notifications WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get("/api/notifications/:id/replies", (req, res) => {
  const replies = db.prepare("SELECT * FROM notification_replies WHERE notification_id = ? ORDER BY created_at ASC").all(req.params.id);
  res.json(replies);
});

app.post("/api/notifications/:id/replies", (req, res) => {
  const { userId, username, reply } = req.body;
  if (!reply || !userId || !username) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  db.prepare("INSERT INTO notification_replies (notification_id, user_id, username, reply) VALUES (?, ?, ?, ?)").run(
    req.params.id,
    userId,
    username,
    reply
  );
  res.json({ success: true });
});

// Subscription Routes
app.post("/api/subscriptions/submit", (req, res) => {
  const { userId, amount, bkashNumber, transactionId } = req.body;
  if (!userId || !amount || !bkashNumber || !transactionId) {
    return res.status(400).json({ success: false, message: "সব তথ্য প্রদান করুন" });
  }
  try {
    db.prepare("INSERT INTO subscriptions (user_id, amount, bkash_number, transaction_id) VALUES (?, ?, ?, ?)").run(
      userId,
      amount,
      bkashNumber,
      transactionId
    );
    res.json({ success: true, message: "আপনার পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে। এডমিন ভেরিফাই করার পর আপনার অ্যাকাউন্ট একটিভ হবে।" });
  } catch (error) {
    res.status(500).json({ success: false, message: "পেমেন্ট রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে" });
  }
});

app.get("/api/admin/subscriptions", (req, res) => {
  try {
    const subscriptions = db.prepare(`
      SELECT s.*, u.username, u.full_name 
      FROM subscriptions s 
      JOIN users u ON s.user_id = u.id 
      ORDER BY s.created_at DESC
    `).all();
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

app.post("/api/admin/subscriptions/approve", (req, res) => {
  const { subscriptionId, userId } = req.body;
  try {
    db.transaction(() => {
      // Approve subscription
      db.prepare("UPDATE subscriptions SET status = 'approved' WHERE id = ?").run(subscriptionId);
      
      // Set user as paid and extend trial by 1 year
      const now = new Date();
      const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      
      db.prepare("UPDATE users SET is_paid = 1, status = 'active', trial_ends_at = ? WHERE id = ?").run(
        nextYear.toISOString(),
        userId
      );

      // Send notification
      db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)").run(
        userId,
        "সাবস্ক্রিপশন সফল!",
        "আপনার ১ বছরের সাবস্ক্রিপশন সফলভাবে একটিভ করা হয়েছে। ধন্যবাদ!",
        "success"
      );
    })();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to approve subscription" });
  }
});

app.post("/api/admin/subscriptions/reject", (req, res) => {
  const { subscriptionId, userId } = req.body;
  try {
    db.prepare("UPDATE subscriptions SET status = 'rejected' WHERE id = ?").run(subscriptionId);
    
    // Send notification
    db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)").run(
      userId,
      "পেমেন্ট রিজেক্ট করা হয়েছে",
      "আপনার পেমেন্ট রিকোয়েস্টটি সঠিক না হওয়ায় রিজেক্ট করা হয়েছে। দয়া করে সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।",
      "error"
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to reject subscription" });
  }
});

app.get("/api/settings", (req, res) => {
  const settings = db.prepare("SELECT * FROM settings").all();
  const settingsObj = settings.reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
  res.json(settingsObj);
});

app.post("/api/settings", (req, res) => {
  const { home_text, home_font_size, auth_text } = req.body;
  
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  
  db.transaction(() => {
    if (home_text !== undefined) upsert.run('home_text', home_text);
    if (home_font_size !== undefined) upsert.run('home_font_size', home_font_size.toString());
    if (auth_text !== undefined) upsert.run('auth_text', auth_text);
  })();

  res.json({ success: true });
});

// User Routes
app.get("/api/books", (req, res) => {
  const books = db.prepare("SELECT id, title, author, description, cover_url, pdf_url, content, category, sort_index, created_at FROM books WHERE (is_deleted = 0 OR is_deleted IS NULL) ORDER BY sort_index ASC, created_at DESC").all();
  res.json(books);
});

app.get("/api/books/:id", (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ message: "Book not found" });
  res.json(book);
});

app.get("/api/books/:id/comments", (req, res) => {
  const comments = db.prepare("SELECT * FROM comments WHERE book_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(comments);
});

app.post("/api/books/:id/comments", (req, res) => {
  const { userId, username, comment } = req.body;
  if (!comment || !userId || !username) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  db.prepare("INSERT INTO comments (book_id, user_id, username, comment) VALUES (?, ?, ?, ?)").run(
    req.params.id,
    userId,
    username,
    comment
  );
  res.json({ success: true });
});

app.delete("/api/comments/:id", (req, res) => {
  db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Initialize default settings if not exists
const initSettings = db.prepare("SELECT COUNT(*) as count FROM settings").get();
if (initSettings.count === 0) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('home_text', 'বইগুলো পড়ে কি শিখবেন?\n\nএখানে আপনার অনুপ্রেরণামূলক লেখা থাকবে।');
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('home_font_size', '16');
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('auth_text', 'এই লাইব্রেরির বইগুলো শুধু পড়ার জন্য নয় — নিজেকে নতুনভাবে গড়ার জন্য।\n📚 এখানে আপনি শিখতে পারবেন:\n✔️ মানুষের আচরণ ও চিন্তা বুঝতে\n✔️ অন্যের পরিকল্পনা আগেভাগে ধরতে\n✔️ প্রভাবশালী যোগাযোগ ও নেতৃত্ব দক্ষতা গড়ে তুলতে\n✔️ মানুষের কাছ থেকে সম্মান অর্জনের কৌশল\n✔️ আত্মসম্মান বজায় রেখে অপমান এড়িয়ে চলার উপায়\n✔️ নিজের ভিতরের লুকানো শক্তি ও দক্ষতা উন্নত করতে\nএই বইগুলো বিশ্বজুড়ে আলোচিত, সমালোচিত এবং শক্তিশালী চিন্তার জন্ম দিয়েছে।\nযারা সাধারণ থাকতে চায় না — তারাই এই জ্ঞান ব্যবহার করে অসাধারণ হয়ে ওঠে।\n👉 আজ পড়া শুরু করুন — আপনার নতুন সংস্করণ তৈরি করুন।\n📲 এবং জ্ঞান ছড়িয়ে দিতে শেয়ার করুন আপনার লাইফ পার্টনার বা প্রিয় মানুষের সাথে৷');
} else {
  // Check if auth_text exists, if not add it
  const authTextExists = db.prepare("SELECT * FROM settings WHERE key = ?").get('auth_text');
  if (!authTextExists) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('auth_text', 'এই লাইব্রেরির বইগুলো শুধু পড়ার জন্য নয় — নিজেকে নতুনভাবে গড়ার জন্য।\n📚 এখানে আপনি শিখতে পারবেন:\n✔️ মানুষের আচরণ ও চিন্তা বুঝতে\n✔️ অন্যের পরিকল্পনা আগেভাগে ধরতে\n✔️ প্রভাবশালী যোগাযোগ ও নেতৃত্ব দক্ষতা গড়ে তুলতে\n✔️ মানুষের কাছ থেকে সম্মান অর্জনের কৌশল\n✔️ আত্মসম্মান বজায় রেখে অপমান এড়িয়ে চলার উপায়\n✔️ নিজের ভিতরের লুকানো শক্তি ও দক্ষতা উন্নত করতে\nএই বইগুলো বিশ্বজুড়ে আলোচিত, সমালোচিত এবং শক্তিশালী চিন্তার জন্ম দিয়েছে।\nযারা সাধারণ থাকতে চায় না — তারাই এই জ্ঞান ব্যবহার করে অসাধারণ হয়ে ওঠে।\n👉 আজ পড়া শুরু করুন — আপনার নতুন সংস্করণ তৈরি করুন।\n📲 এবং জ্ঞান ছড়িয়ে দিতে শেয়ার করুন আপনার লাইফ পার্টনার বা প্রিয় মানুষের সাথে৷');
  }
}

async function startServer() {
  // Wishlist & Reading History Routes
  app.get("/api/users/:userId/wishlist", (req, res) => {
    const { userId } = req.params;
    const wishlist = db.prepare(`
      SELECT b.* FROM books b
      JOIN wishlist w ON b.id = w.book_id
      WHERE w.user_id = ? AND b.is_deleted = 0
      ORDER BY w.created_at DESC
    `).all(userId);
    res.json(wishlist);
  });

  app.get("/api/users/:userId/wishlist/:bookId", (req, res) => {
    const { userId, bookId } = req.params;
    const item = db.prepare("SELECT * FROM wishlist WHERE user_id = ? AND book_id = ?").get(userId, bookId);
    res.json({ inWishlist: !!item });
  });

  app.post("/api/users/:userId/wishlist", (req, res) => {
    const { userId } = req.params;
    const { bookId } = req.body;
    try {
      db.prepare("INSERT INTO wishlist (user_id, book_id) VALUES (?, ?)").run(userId, bookId);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Already in wishlist" });
    }
  });

  app.delete("/api/users/:userId/wishlist/:bookId", (req, res) => {
    const { userId, bookId } = req.params;
    db.prepare("DELETE FROM wishlist WHERE user_id = ? AND book_id = ?").run(userId, bookId);
    res.json({ success: true });
  });

  app.get("/api/users/:userId/reading-history", (req, res) => {
    const { userId } = req.params;
    const history = db.prepare(`
      SELECT b.*, h.read_at FROM books b
      JOIN reading_history h ON b.id = h.book_id
      WHERE h.user_id = ? AND b.is_deleted = 0
      GROUP BY b.id
      ORDER BY h.read_at DESC
      LIMIT 50
    `).all(userId);
    res.json(history);
  });

  app.post("/api/users/:userId/reading-history", (req, res) => {
    const { userId } = req.params;
    const { bookId } = req.body;
    // Update if exists, or insert new
    db.prepare("INSERT INTO reading_history (user_id, book_id) VALUES (?, ?)").run(userId, bookId);
    res.json({ success: true });
  });

  // Support Message Routes
  app.post("/api/support/send", (req, res) => {
    const { userId, username, message, sender_role } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "মেসেজ লিখুন" });
    }
    try {
      console.log(`Sending support message: user=${userId}, role=${sender_role}`);
      db.prepare("INSERT INTO support_messages (user_id, username, message, sender_role) VALUES (?, ?, ?, ?)").run(
        userId ? String(userId) : null,
        username || 'Guest',
        message,
        sender_role || 'user'
      );
      res.json({ success: true, message: "মেসেজ পাঠানো হয়েছে।" });
    } catch (error) {
      console.error("Support send error:", error);
      res.status(500).json({ success: false, message: "মেসেজ পাঠাতে সমস্যা হয়েছে" });
    }
  });

  app.get("/api/support/messages/:userId", (req, res) => {
    const { userId } = req.params;
    try {
      const messages = db.prepare("SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at ASC").all(userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ success: false, message: "মেসেজ লোড করতে সমস্যা হয়েছে" });
    }
  });

  app.get("/api/admin/support/messages", (req, res) => {
    try {
      // Get unique users who have messaged, with their latest info
      const users = db.prepare(`
        SELECT user_id, username, 
        (SELECT message FROM support_messages WHERE user_id = sm.user_id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM support_messages WHERE user_id = sm.user_id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM support_messages WHERE user_id = sm.user_id AND status = 'unread' AND sender_role = 'user') as unread_count
        FROM support_messages sm
        WHERE id IN (SELECT MAX(id) FROM support_messages GROUP BY user_id)
        ORDER BY last_message_at DESC
      `).all();
      res.json(users);
    } catch (error) {
      res.status(500).json({ success: false, message: "মেসেজ লোড করতে সমস্যা হয়েছে" });
    }
  });

  app.get("/api/admin/support/messages/:userId", (req, res) => {
    const { userId } = req.params;
    try {
      const messages = db.prepare("SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at ASC").all(userId);
      // Mark as read
      db.prepare("UPDATE support_messages SET status = 'read' WHERE user_id = ? AND sender_role = 'user'").run(userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ success: false, message: "মেসেজ লোড করতে সমস্যা হয়েছে" });
    }
  });
  app.delete("/api/admin/support/messages/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM support_messages WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "মেসেজ ডিলিট করতে সমস্যা হয়েছে" });
    }
  });

  app.delete("/api/admin/support/chat/:userId", (req, res) => {
    try {
      db.prepare("DELETE FROM support_messages WHERE user_id = ?").run(req.params.userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "চ্যাট ডিলিট করতে সমস্যা হয়েছে" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
