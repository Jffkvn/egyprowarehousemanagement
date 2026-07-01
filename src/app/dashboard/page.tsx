"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import PMDashboard from '@/components/dashboard/PMDashboard';
import WMDashboard from '@/components/dashboard/WMDashboard';
import CFODashboard from '@/components/dashboard/CFODashboard';

export default function DashboardRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-24">
        <p className="text-sm text-text-muted">Awaiting redirect to login...</p>
      </div>
    );
  }

  // Render role-specific dashboard layout
  switch (user.role) {
    case 'cfo':
      return <CFODashboard />;
    case 'warehouse_manager':
      return <WMDashboard />;
    case 'pm':
      return <PMDashboard />;
    default:
      return (
        <div className="text-center py-24 bg-surface border border-border rounded-lg">
          <p className="text-sm text-danger font-semibold">Error: User role not recognized.</p>
        </div>
      );
  }
}
