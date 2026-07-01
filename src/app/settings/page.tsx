"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, User, Settings } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { Save, Plus, X, ShieldAlert, Check } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Form thresholds
  const [approvalThreshold, setApprovalThreshold] = useState('');
  
  // Create User form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'pm' | 'warehouse_manager' | 'cfo'>('pm');

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const sets = await db.getSettings();
      const usrs = await db.getUsers();
      setSettings(sets);
      setApprovalThreshold(sets.approval_threshold_ugx.toString());
      setUsersList(usrs);
    } catch (err) {
      console.error('Error fetching settings/users data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'cfo') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user, router]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;

    setSubmitting(true);
    try {
      await db.updateSettings(parseFloat(approvalThreshold), user.id);
      setToastMsg('Settings updated');
      setTimeout(() => setToastMsg(null), 2000);
      fetchData();
    } catch (err) {
      console.error('Error updating settings:', err);
      alert('Failed to update settings');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;

    setActionLoading(true);
    try {
      await db.addUser({
        full_name: fullName,
        email,
        phone: phone || undefined,
        role
      });
      setIsModalOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setRole('pm');
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create user');
    } finally {
      setActionLoading(false);
    }
  };

  const [actionLoading, setActionLoading] = useState(false);

  const roleNames = {
    cfo: 'CFO (Financial Admin)',
    warehouse_manager: 'Warehouse Manager',
    pm: 'Project Manager (Field PM)'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center bg-success text-white px-4 py-3 rounded-md shadow-md text-sm font-semibold transition-all">
          <Check size={16} className="mr-2" />
          {toastMsg}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-navy">System Settings</h2>
        <p className="text-sm text-text-muted">Configure the automated approvals threshold settings and provision active accounts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Threshold Panel */}
        <div className="lg:col-span-1 bg-surface border border-border rounded-lg p-6 shadow-sm h-fit">
          <h3 className="text-sm font-bold text-navy mb-1">Approval Threshold Policy</h3>
          <p className="text-xs text-text-muted mb-4">Set limits for Warehouse Manager autonomous approvals</p>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Approval Threshold (UGX)
              </label>
              <input
                type="number"
                required
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary font-mono font-semibold"
              />
              <p className="text-[10px] text-text-muted mt-2">
                Any equipment request containing items valued at or above this threshold, or depleting stock, will be routed to the CFO for manual sign-off.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-md transition-colors flex items-center justify-center space-x-1.5"
            >
              <Save size={14} />
              <span>Save Policy Settings</span>
            </button>
          </form>
        </div>

        {/* User Accounts Provisioning */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-lg shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy">User Directory</h3>
                <p className="text-xs text-text-muted">Manage active directory profiles and roles</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center space-x-1.5 border border-primary text-primary hover:bg-primary/5 font-semibold text-xs rounded-md px-3 h-8 transition-colors"
              >
                <Plus size={14} />
                <span>Add User</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                    <th className="px-6 py-3">Full Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Account Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {usersList.map((usr) => (
                    <tr key={usr.id} className="hover:bg-background/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-navy">{usr.full_name}</td>
                      <td className="px-6 py-4 text-text">{usr.email}</td>
                      <td className="px-6 py-4 text-text-muted">{usr.phone || '—'}</td>
                      <td className="px-6 py-4 font-medium text-text capitalize">
                        {roleNames[usr.role] || usr.role}
                      </td>
                      <td className="px-6 py-4">
                        {usr.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-success-tint text-success font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-neutral-tint text-text-muted font-medium">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="h-14 border-b border-border px-6 flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy">Provision User Account</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  placeholder="e.g. John Peter"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Email Address <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  placeholder="e.g. john@egypro.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Phone (optional)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  placeholder="e.g. +256 701 000000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  System Role Access <span className="text-danger">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                >
                  <option value="pm">Project Manager (PM) - Field Requests</option>
                  <option value="warehouse_manager">Warehouse Manager (WM) - Log Checkouts/Returns</option>
                  <option value="cfo">CFO - Financial Oversight & Approvals</option>
                </select>
              </div>

              <div className="border-t border-border pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 h-10 border border-border text-text rounded-md text-sm font-semibold hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 h-10 bg-primary hover:bg-primary/95 text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center"
                >
                  {actionLoading ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
