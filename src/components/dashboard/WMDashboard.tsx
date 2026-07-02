"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Request, Equipment, ConsumableStock, Transaction } from '@/lib/db';
import { StatusBadge } from './PMDashboard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ClipboardList, 
  Clock, 
  AlertTriangle, 
  TrendingDown, 
  CheckSquare, 
  LogOut,
  Calendar,
  User,
  ArrowRight,
  RefreshCw,
  X,
  ShieldAlert,
  ScanLine,
  Camera
} from 'lucide-react';

export default function WMDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [consumables, setConsumables] = useState<ConsumableStock[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'approvals' | 'fulfillment' | 'overdue' | 'activity'>('approvals');
  const [refreshKey, setRefreshKey] = useState(0);

  // Overdue Returns Escalation States
  const [escalatedIds, setEscalatedIds] = useState<string[]>([]);
  const [selectedOverdueItem, setSelectedOverdueItem] = useState<any | null>(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allRequests = await db.getRequests();
        const allEq = await db.getEquipment();
        const allCon = await db.getConsumables();
        const allTx = await db.getTransactions();

        // Run overdue check in background (just in case)
        await db.checkOverdueItems();

        setRequests(allRequests);
        setEquipment(allEq);
        setConsumables(allCon);
        setTransactions(allTx);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  useEffect(() => {
    const handleRefreshData = () => {
      setLoading(true);
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('refresh-data', handleRefreshData);
    return () => {
      window.removeEventListener('refresh-data', handleRefreshData);
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOverdueItem || !user || escalationReason.length < 10) return;

    setEscalating(true);
    try {
      const cfos = (await db.getUsers()).filter(u => u.role === 'cfo');
      
      for (const cfo of cfos) {
        await db.createNotification(
          cfo.company_id,
          cfo.id,
          'Overdue Return Escalation',
          `🕐 Overdue escalation: ${selectedOverdueItem.asset_code} ${selectedOverdueItem.name} is overdue. Reason: ${escalationReason}`,
          `/equipment?id=${selectedOverdueItem.id}`
        );

        try {
          await fetch('/api/push-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: cfo.id,
              title: 'Overdue Return Escalation',
              message: `🕐 Overdue escalation: ${selectedOverdueItem.asset_code} ${selectedOverdueItem.name} is overdue. Reason: ${escalationReason}`,
              link: `/equipment?id=${selectedOverdueItem.id}`
            })
          });
        } catch (pushErr) {
          console.warn('API push notify trigger failed:', pushErr);
        }
      }

      setEscalatedIds(prev => [...prev, selectedOverdueItem.id]);
      setSelectedOverdueItem(null);
      setEscalationReason('');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error('Error escalating item:', err);
      alert('Escalation failed');
    } finally {
      setEscalating(false);
    }
  };

  // Card Counters
  const pendingApprovals = requests.filter(r => r.status === 'pending' && r.routed_to === 'warehouse_manager');
  const pendingFulfillments = requests.filter(r => r.status === 'approved');
  const overdueItems = equipment.filter(e => e.status === 'overdue');
  const lowStockConsumables = consumables.filter(c => c.quantity_on_hand <= c.reorder_level);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-navy">Warehouse Logistics Command</h2>
          <p className="text-sm text-text-muted">Manage stock intakes, approvals, and logistics handoffs</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 border border-border bg-surface text-text hover:bg-background rounded-md transition-all"
          title="Refresh Dashboard"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Scan Shortcut banner */}
      <div className="bg-gradient-to-r from-navy to-navy/90 text-white rounded-xl border border-white/10 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5 text-center sm:text-left">
          <div className="p-3 bg-white/10 rounded-xl border border-white/15">
            <ScanLine size={24} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Scan Barcode / QR Code</h3>
            <p className="text-xs text-white/70">Instantly check out items, log returns, or inspect current catalog records</p>
          </div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event('open-scanner'))}
          className="h-10 px-5 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-md focus:outline-none flex-shrink-0"
        >
          <Camera size={14} />
          <span>Launch Camera Scanner</span>
        </button>
      </div>

      {/* Counters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div 
          onClick={() => setActiveTab('approvals')}
          className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-warning/40 hover:bg-warning-tint/5 transition-all"
        >
          <div className="p-3 bg-warning-tint text-warning rounded-lg">
            <ClipboardList size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-navy">{pendingApprovals.length}</div>
            <div className="text-xs text-text-muted font-medium">Pending Approvals</div>
          </div>
        </div>

        {/* Card 2 */}
        <div 
          onClick={() => setActiveTab('fulfillment')}
          className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <div className="p-3 bg-primary/10 text-primary rounded-lg">
            <CheckSquare size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-navy">{pendingFulfillments.length}</div>
            <div className="text-xs text-text-muted font-medium">Pending Fulfillment</div>
          </div>
        </div>

        {/* Card 3 */}
        <div 
          onClick={() => setActiveTab('overdue')}
          className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-danger/40 hover:bg-danger-tint/5 transition-all"
        >
          <div className="p-3 bg-danger-tint text-danger rounded-lg">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-navy">{overdueItems.length}</div>
            <div className="text-xs text-text-muted font-medium">Items Overdue</div>
          </div>
        </div>

        {/* Card 4 */}
        <div 
          onClick={() => router.push('/equipment?status=low_stock')}
          className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-navy/40 hover:bg-navy/5 transition-all"
        >
          <div className="p-3 bg-neutral-tint text-text rounded-lg">
            <TrendingDown size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-navy">{lowStockConsumables.length}</div>
            <div className="text-xs text-text-muted font-medium">Low Stock Alerts</div>
          </div>
        </div>
      </div>

      {/* Tabbed Layout Area */}
      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-background/30 overflow-x-auto">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all
              ${activeTab === 'approvals' 
                ? 'border-primary text-primary bg-surface' 
                : 'border-transparent text-text-muted hover:text-navy'}
            `}
          >
            Pending Approvals ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setActiveTab('fulfillment')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all
              ${activeTab === 'fulfillment' 
                ? 'border-primary text-primary bg-surface' 
                : 'border-transparent text-text-muted hover:text-navy'}
            `}
          >
            Pending Fulfillment ({pendingFulfillments.length})
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all
              ${activeTab === 'overdue' 
                ? 'border-primary text-primary bg-surface' 
                : 'border-transparent text-text-muted hover:text-navy'}
            `}
          >
            Overdue Returns ({overdueItems.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all
              ${activeTab === 'activity' 
                ? 'border-primary text-primary bg-surface' 
                : 'border-transparent text-text-muted hover:text-navy'}
            `}
          >
            Recent Activity
          </button>
        </div>

        {/* Tab Content Tables */}
        <div className="overflow-x-auto">
          {activeTab === 'approvals' && (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                  <th className="px-6 py-3">Project & PM</th>
                  <th className="px-6 py-3">Site Location</th>
                  <th className="px-6 py-3">Items Requested</th>
                  <th className="px-6 py-3">Needed From</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingApprovals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-xs text-text-muted italic">
                      No requests awaiting your approval.
                    </td>
                  </tr>
                ) : (
                  pendingApprovals.map(req => {
                    const itemsSummary = req.items?.map(it => `${it.name} (x${it.quantity_requested})`).join(', ') || 'No items';
                    return (
                      <tr key={req.id} className="hover:bg-background/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-navy">{req.project_name}</div>
                          <div className="text-xs text-text-muted flex items-center mt-0.5">
                            <User size={12} className="mr-1" />
                            <span>{req.requested_by_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-text">{req.site_location || 'Not Specified'}</td>
                        <td className="px-6 py-4 max-w-xs truncate" title={itemsSummary}>{itemsSummary}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-text">{req.needed_from}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                          <Link
                            href={`/requests/${req.id}`}
                            className="inline-flex items-center space-x-1 bg-primary text-white hover:bg-primary/95 rounded px-3 h-8 font-semibold transition-colors"
                          >
                            <span>Review</span>
                            <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'fulfillment' && (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                  <th className="px-6 py-3">Project & PM</th>
                  <th className="px-6 py-3">Site Location</th>
                  <th className="px-6 py-3">Items Requested</th>
                  <th className="px-6 py-3">Fulfillment Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingFulfillments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-xs text-text-muted italic">
                      No approved requests awaiting fulfillment.
                    </td>
                  </tr>
                ) : (
                  pendingFulfillments.map(req => {
                    const itemsSummary = req.items?.map(it => `${it.name} (x${it.quantity_requested})`).join(', ') || 'No items';
                    return (
                      <tr key={req.id} className="hover:bg-background/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-navy">{req.project_name}</div>
                          <div className="text-xs text-text-muted flex items-center mt-0.5">
                            <User size={12} className="mr-1" />
                            <span>{req.requested_by_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-text">{req.site_location || 'Not Specified'}</td>
                        <td className="px-6 py-4 max-w-xs truncate" title={itemsSummary}>{itemsSummary}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/10">
                            Approved
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                          {req.status === 'approved' ? (
                            <Link
                              href={`/requests/${req.id}`}
                              className="inline-flex items-center space-x-1 bg-primary text-white hover:bg-primary/95 rounded px-3 h-8 font-semibold transition-colors"
                            >
                              <span>Checkout</span>
                            </Link>
                          ) : (
                            <Link
                              href={`/requests/${req.id}`}
                              className="inline-flex items-center space-x-1 bg-navy text-white hover:bg-navy/95 rounded px-3 h-8 font-semibold transition-colors"
                            >
                              <span>Manage Handoff</span>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'overdue' && (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                  <th className="px-6 py-3">Asset Code</th>
                  <th className="px-6 py-3">Equipment Name</th>
                  <th className="px-6 py-3">Current Location</th>
                  <th className="px-6 py-3">Return Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overdueItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-xs text-text-muted italic">
                      No equipment is currently marked overdue.
                    </td>
                  </tr>
                ) : (
                  overdueItems.map(eq => (
                    <tr key={eq.id} className="hover:bg-background/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-navy">{eq.asset_code}</td>
                      <td className="px-6 py-4 font-semibold text-text">{eq.name}</td>
                      <td className="px-6 py-4 text-xs text-text">{eq.current_location || 'Field'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status="overdue" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs space-x-2">
                        <Link
                          href={`/equipment?id=${eq.id}`}
                          className="inline-flex items-center space-x-1 border border-navy/20 text-navy hover:bg-navy/5 rounded px-3 h-8 font-semibold transition-colors"
                        >
                          <span>View in Catalog</span>
                        </Link>
                        {escalatedIds.includes(eq.id) ? (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center justify-center bg-gray-100 border border-border text-text-muted rounded px-3 h-8 font-semibold text-xs disabled:opacity-50"
                          >
                            Escalated
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedOverdueItem(eq)}
                            className="inline-flex items-center space-x-1 border border-amber-600/30 text-amber-600 hover:bg-amber-50 rounded px-3 h-8 font-semibold transition-all hover:border-amber-600"
                          >
                            Escalate to CFO
                          </button>
                        )}
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'activity' && (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                  <th className="px-6 py-3">Log Timestamp</th>
                  <th className="px-6 py-3">Activity Type</th>
                  <th className="px-6 py-3">Asset / Item Name</th>
                  <th className="px-6 py-3">Quantity</th>
                  <th className="px-6 py-3">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {transactions.slice(0, 10).map(tx => {
                  const txLabels = {
                    checkout: 'Checked Out to Field',
                    return: 'Returned to Warehouse',
                    stock_added: 'Stock Inward Intake',
                    stock_consumed: 'Stock Outward Consumed',
                    retired: 'Asset Retired',
                    sent_for_repair: 'Sent for Maintenance',
                    returned_from_repair: 'Returned from Repair'
                  };
                  return (
                    <tr key={tx.id} className="hover:bg-background/40 transition-colors">
                      <td className="px-6 py-4 text-text-muted">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-semibold text-navy">
                        {txLabels[tx.transaction_type] || tx.transaction_type}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-text">{tx.item_name}</div>
                        {tx.asset_or_sku_code && (
                          <div className="text-[10px] text-text-muted font-mono">{tx.asset_or_sku_code}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-text">
                        {tx.quantity} unit{tx.quantity > 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 text-text-muted">
                        {tx.performed_by_name}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Escalation Toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold animate-slide-in">
          Escalation request sent to CFO
        </div>
      )}

      {/* Escalation Modal */}
      {selectedOverdueItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-xl overflow-hidden animate-scale-up">
            <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-background">
              <h3 className="text-sm font-bold text-navy">Escalate Overdue return to CFO</h3>
              <button 
                type="button"
                onClick={() => {
                  setSelectedOverdueItem(null);
                  setEscalationReason('');
                }}
                className="text-text-muted hover:text-text p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEscalateSubmit} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md text-xs">
                Escalating <strong>{selectedOverdueItem.asset_code} - {selectedOverdueItem.name}</strong> will send an instant SMS/WhatsApp &amp; Email notification to CFO administrators to request financial audit overrides.
              </div>

              <div>
                <label className="block text-xs font-bold text-navy uppercase mb-1">
                  Reason for escalation *
                </label>
                <textarea
                  required
                  rows={3}
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  placeholder="e.g. Field PM not responding to text messages or phone calls; equipment cannot be physically located."
                  className="w-full p-2.5 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Min 10 characters required. Currently: {escalationReason.length}
                </p>
              </div>

              <div className="border-t border-border pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOverdueItem(null);
                    setEscalationReason('');
                  }}
                  className="px-4 h-9 border border-border text-text rounded text-xs font-semibold hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={escalating || escalationReason.length < 10}
                  className="px-4 h-9 bg-primary hover:bg-primary/95 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {escalating ? 'Sending Escalation...' : 'Confirm Escalation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
