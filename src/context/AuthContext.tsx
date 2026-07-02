"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, User } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password?: string) => Promise<boolean>;
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
    const initAuth = async () => {
      try {
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const profile = await db.getCurrentUser(session.user.id);
            if (profile) {
              setUser(profile);
            }
          }

          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
              setUser(null);
            } else if (session) {
              const profile = await db.getCurrentUser(session.user.id);
              if (profile) setUser(profile);
            }
          });

          return () => {
            subscription.unsubscribe();
          };
        } else {
          const cachedUserId = localStorage.getItem('equip_track_user_id');
          if (cachedUserId) {
            const profile = await db.getCurrentUser(cachedUserId);
            if (profile) {
              setUser(profile);
            } else {
              localStorage.removeItem('equip_track_user_id');
            }
          }
        }
      } catch (err) {
        console.error('Error initializing authentication:', err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
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

  const signIn = async (email: string, password?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      if (supabase) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: password || 'password123',
        });
        if (signInError) throw signInError;

        const profile = await db.getCurrentUser(data.user.id);
        if (profile) {
          setUser(profile);
          router.push('/dashboard');
          return true;
        } else {
          setError('No user profile found for this auth account.');
          return false;
        }
      } else {
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
      if (supabase) {
        await supabase.auth.signOut();
      } else {
        localStorage.removeItem('equip_track_user_id');
      }
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
