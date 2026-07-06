"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

export default function LoginPage() {
  const { signIn, error, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    await signIn(email, password);
  };

  const setDemoCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <Image 
            src="/logo.png" 
            alt="Egypro Logo" 
            width={64} 
            height={64}
            className="mb-4"
          />
          <h2 className="text-xl font-bold text-navy">Egypro EquipTrack</h2>
          <p className="text-xs text-text-muted mt-1">Uganda Telecom Field Logistics Portal</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-tint text-danger border border-danger/20 rounded-md text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
              placeholder="e.g. pm@egypro.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-md transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-xs font-semibold text-navy mb-3">Quick Login (Demo Accounts):</h3>
          <div className="grid grid-cols-5 gap-1.5">
            <button
              onClick={() => setDemoCredentials('coordinator@egypro.com')}
              className="px-1 py-1.5 bg-success/10 hover:bg-success/20 text-success border border-success/25 rounded text-[10px] font-bold transition-colors text-center truncate"
              title="Project Coordinator"
            >
              Coordinator
            </button>
            <button
              onClick={() => setDemoCredentials('pm@egypro.com')}
              className="px-1 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded text-[10px] font-bold transition-colors text-center truncate"
              title="Project Manager"
            >
              PM
            </button>
            <button
              onClick={() => setDemoCredentials('wm@egypro.com')}
              className="px-1 py-1.5 bg-navy/10 hover:bg-navy/20 text-navy border border-navy/25 rounded text-[10px] font-bold transition-colors text-center truncate"
              title="Warehouse Manager"
            >
              Warehouse
            </button>
            <button
              onClick={() => setDemoCredentials('cfo@egypro.com')}
              className="px-1 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/25 rounded text-[10px] font-bold transition-colors text-center truncate"
              title="CFO"
            >
              CFO
            </button>
            <button
              onClick={() => setDemoCredentials('md@egypro.com')}
              className="px-1 py-1.5 bg-neutral-tint hover:bg-neutral text-text border border-border rounded text-[10px] font-bold transition-colors text-center"
              title="Managing Director"
            >
              MD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
