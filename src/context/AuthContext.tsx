"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, User } from '@/lib/db';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const cachedUserId = localStorage.getItem('equip_track_user_id');
        if (cachedUserId) {
          const profile = await db.getCurrentUser(cachedUserId);
          if (profile) {
            setUser(profile);
          } else {
            localStorage.removeItem('equip_track_user_id');
          }
        }
      } catch (err) {
        console.error('Error checking active session:', err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Handle route protection
  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const signIn = async (email: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const profile = await db.login(email);
      if (profile) {
        setUser(profile);
        localStorage.setItem('equip_track_user_id', profile.id);
        router.push('/dashboard');
        return true;
      } else {
        setError('No active account found with this email.');
        return false;
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('equip_track_user_id');
      setUser(null);
      router.push('/login');
    } catch (err) {
      console.error('Signout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
