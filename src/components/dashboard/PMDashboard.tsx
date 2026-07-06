"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Request, CashAdvance } from '@/lib/db';
import Link from 'next/link';
import { PlusCircle, Search, Calendar, MapPin, Eye, Package, Coins, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    available: 'bg-success-tint text-success border-success/20',
    checked_out: 'bg-warning-tint text-warning border-warning/20',
    overdue: 'bg-danger-tint text-danger border-danger/20',
    under_repair: 'bg-neutral-tint text-text border-neutral/20',
    retired: 'bg-neutral-tint text-text-muted border-neutral/20',
    pending_inspection: 'bg-warning-tint text-text border-warning/20',
    pending: 'bg-warning-tint text-warning border-warning/20',
    approved: 'bg-success-tint text-success border-success/20',
    rejected: 'bg-danger-tint text-danger border-danger/20',
    fulfilled: 'bg-success-tint text-success border-success/20',
    returned: 'bg-success-tint text-success border-success/20',
    cancelled: 'bg-neutral-tint text-text-muted border-neutral/20',
    disbursed: 'bg-warning-tint text-warning border-warning/20',
    partially_retired: 'bg-warning-tint text-warning border-warning/20'
  };

  const displayLabels: Record<string, string> = {
    available: 'Available',
    checked_out: 'Checked Out',
    overdue: 'Overdue',
    under_repair: 'Under Repair',
    retired: 'Retired',
    pending_inspection: 'Pending Inspection',
    pending: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    fulfilled: 'Checked Out',
    returned: 'Returned',
    cancelled: 'Cancelled',
    disbursed: 'Disbursed',
    partially_retired: 'Partially Accounted'
  };

  const style = styles[status] || 'bg-background text-text border-border';
  const label = displayLabels[status] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}

export default function PMDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [pendingEndorseRequests, setPendingEndorseRequests] = useState<Request[]>([]);
  const [pendingEndorseAdvances, setPendingEndorseAdvances] = useState<CashAdvance[]>([]);
  const [endorsementNotes, setEndorsementNotes] = useState<Record<string, string>>({});
  const [endorsingId, setEndorsingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-ops' | 'endorsements'>('my-ops');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const allRequests = await db.getRequests();
      // Filter PM's own requests
      const ownRequests = allRequests.filter(r => r.requested_by === user.id);
      setRequests(ownRequests);

      // Fetch PM's own advances
      try {
        const ownAdvances = await db.getCashAdvances('pm', user.id);
        setAdvances(ownAdvances);
      } catch (e) {
        console.warn('Failed to fetch PM advances in dashboard:', e);
      }

      // Fetch active project assignments to filter coordinator requests needing PM endorsement
      const assignments = await db.getProjectAssignments();
      const pmProjectIds = assignments
        .filter(a => a.user_id === user.id && a.role_on_project === 'pm' && !a.unassigned_at)
        .map(a => a.project_id);

      // Filter logistics requests needing endorsement
      const candRequests = allRequests.filter(
        r => !!r.project_id && pmProjectIds.includes(r.project_id) && r.status === 'pending' && r.requested_by !== user.id
      );
      const reqWithEndorsements = await Promise.all(
        candRequests.map(async r => {
          const end = await db.getRequestEndorsement(r.id);
          return { r, hasEndorsement: end !== null };
        })
      );
      setPendingEndorseRequests(reqWithEndorsements.filter(x => !x.hasEndorsement).map(x => x.r));

      // Filter cash advances needing endorsement
      try {
        const companyAdvances = await db.getCashAdvances('cfo', user.id);
        const candAdvances = companyAdvances.filter(
          a => !!a.project_id && pmProjectIds.includes(a.project_id) && a.status === 'pending' && a.requested_by !== user.id
        );
        const advWithEndorsements = await Promise.all(
          candAdvances.map(async a => {
            const end = await db.getAdvanceEndorsement(a.id);
            return { a, hasEndorsement: end !== null };
          })
        );
        setPendingEndorseAdvances(advWithEndorsements.filter(x => !x.hasEndorsement).map(x => x.a));
      } catch (e) {
        console.warn('Failed to fetch company advances for PM dashboard endorsements:', e);
      }

    } catch (err) {
      console.error('Error fetching PM requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleEndorseRequest = async (requestId: string) => {
    if (!user) return;
    const note = endorsementNotes[requestId] || '';
    setEndorsingId(requestId);
    try {
      await db.endorseRequest(requestId, user.id, note);
      alert('Request endorsed successfully!');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Failed to endorse request.');
    } finally {
      setEndorsingId(null);
    }
  };

  const handleEndorseAdvance = async (advanceId: string) => {
    if (!user) return;
    const note = endorsementNotes[advanceId] || '';
    setEndorsingId(advanceId);
    try {
      await db.endorseAdvance(advanceId, user.id, note);
      alert('Cash advance request endorsed successfully!');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Failed to endorse cash advance request.');
    } finally {
      setEndorsingId(null);
    }
  };

  const filteredRequests = requests.filter(r => 
    (r.project_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.site_location && r.site_location.toLowerCase().includes(search.toLowerCase()))
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(val);
  };

  // Compute PM Cash Metrics
  const pmOutstandingBalance = advances.reduce((sum, a) => sum + (a.outstanding_ugx || 0), 0);
  const pmOverdueCount = advances.filter(a => a.status === 'overdue').length;
  const pmPendingCount = advances.filter(a => a.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* PM Welcome Header */}
      <div>
        <h2 className="text-xl font-bold text-navy">Project Manager Dashboard</h2>
        <p className="text-sm text-text-muted">Manage field operations, logistics requests, and project cash accountabilities</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('my-ops')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'my-ops'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-navy'
          }`}
        >
          My Submissions & Operations
        </button>
        <button
          onClick={() => setActiveTab('endorsements')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'endorsements'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-navy'
          }`}
        >
          <span>Coordinator Endorsements Queue</span>
          {(pendingEndorseRequests.length + pendingEndorseAdvances.length) > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] bg-warning text-navy font-bold rounded-full">
              {pendingEndorseRequests.length + pendingEndorseAdvances.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'my-ops' ? (
        <>
          {/* Cash Advances Overview Row */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">My Petty Cash Accountability</h3>
              <Link href="/advances" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                Open cash console <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Outstanding Box */}
              <div className="p-4 bg-surface border border-border rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-muted">My Outstanding Balance</span>
                  <Coins className="w-5 h-5 text-warning" />
                </div>
                <p className="text-lg font-bold text-navy">{formatCurrency(pmOutstandingBalance)}</p>
                <p className="text-[10px] text-text-muted mt-1">Awaiting spent receipts &amp; retirement</p>
              </div>

              {/* Pending Review Box */}
              <div className="p-4 bg-surface border border-border rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-muted">Pending CFO Approvals</span>
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <p className="text-lg font-bold text-navy">{pmPendingCount}</p>
                <p className="text-[10px] text-text-muted mt-1">Requests currently in CFO queue</p>
              </div>

              {/* Overdue Reports Box */}
              <div className="p-4 bg-surface border border-border rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-muted">Overdue Accountability Reports</span>
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <p className={`text-lg font-bold ${pmOverdueCount > 0 ? 'text-danger' : 'text-navy'}`}>{pmOverdueCount}</p>
                <p className="text-[10px] text-text-muted mt-1">Overdue items locking request actions</p>
              </div>
            </div>
          </div>

          {/* Equipment Requests Header */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">My Logistics &amp; Equipment Requisitions</h3>
              <Link 
                href="/requests/new"
                className="inline-flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-md px-4 h-10 transition-colors"
              >
                <PlusCircle size={16} />
                <span>Request Equipment</span>
              </Link>
            </div>

            {requests.length === 0 ? (
              /* Empty State */
              <div className="bg-surface border border-border rounded-lg p-12 text-center flex flex-col items-center">
                <Package className="w-12 h-12 text-text-muted mb-4" />
                <h3 className="text-base font-semibold text-navy mb-1">No equipment requests yet</h3>
                <p className="text-sm text-text-muted mb-6 max-w-sm">
                  Submit your first request to reserve reusable tools or consumable stock for your active ATC project.
                </p>
                <Link 
                  href="/requests/new"
                  className="inline-flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-md px-4 h-10 transition-colors"
                >
                  <PlusCircle size={16} />
                  <span>Create First Request</span>
                </Link>
              </div>
            ) : (
              /* Requests Table */
              <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="relative w-full max-w-xs">
                    <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search requests..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary"
                    />
                  </div>
                  <span className="text-xs text-text-muted font-medium">
                    Showing {filteredRequests.length} of {requests.length} requests
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                        <th className="px-6 py-3">Project Name &amp; Site</th>
                        <th className="px-6 py-3">Requested Items</th>
                        <th className="px-6 py-3">Needed From</th>
                        <th className="px-6 py-3">Needed Until</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Submitted</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {filteredRequests.map((req) => {
                        const itemsSummary = req.items?.map(it => `${it.name} (x${it.quantity_requested})`).join(', ') || 'No items';
                        return (
                          <tr key={req.id} className="hover:bg-background/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-navy">{req.project_name}</div>
                              {req.site_location && (
                                <div className="text-xs text-text-muted flex items-center mt-0.5">
                                  <MapPin size={12} className="mr-1 flex-shrink-0" />
                                  <span>{req.site_location}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 max-w-xs truncate" title={itemsSummary}>
                              {itemsSummary}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-text">
                              <div className="flex items-center">
                                <Calendar size={12} className="mr-1 text-text-muted" />
                                {req.needed_from}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-text">
                              {req.needed_until ? (
                                <div className="flex items-center">
                                  <Calendar size={12} className="mr-1 text-text-muted" />
                                  {req.needed_until}
                                </div>
                              ) : (
                                <span className="text-text-muted">— (Consumable)</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={req.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-text-muted">
                              {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Link 
                                href={`/requests/${req.id}`}
                                className="inline-flex items-center space-x-1 border border-border hover:bg-background rounded px-3 h-8 text-xs font-semibold text-navy transition-colors"
                              >
                                <span>Details</span>
                                <Eye size={12} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-8">
          {/* Coordinator Logistics requests */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">Logistics Requisitions Pending Endorsement</h3>
            {pendingEndorseRequests.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg p-8 text-center text-xs text-text-muted">
                No coordinator equipment requests pending endorsement.
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-background text-text-muted font-semibold uppercase border-b border-border">
                      <th className="px-4 py-3">Coordinator</th>
                      <th className="px-4 py-3">Project &amp; Site</th>
                      <th className="px-4 py-3">Items Summary</th>
                      <th className="px-4 py-3">Endorsement Note</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingEndorseRequests.map(req => {
                      const itemsSummary = req.items?.map(it => `${it.name} (x${it.quantity_requested})`).join(', ') || 'No items';
                      return (
                        <tr key={req.id} className="hover:bg-background/25">
                          <td className="px-4 py-3 font-semibold text-text">{req.requested_by_name}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-navy">{req.project_name}</div>
                            {req.site_location && <div className="text-[10px] text-text-muted">{req.site_location}</div>}
                          </td>
                          <td className="px-4 py-3 max-w-xs truncate" title={itemsSummary}>{itemsSummary}</td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              placeholder="Optional endorsement note..."
                              value={endorsementNotes[req.id] || ''}
                              onChange={e => setEndorsementNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="w-full h-8 px-2.5 border border-border rounded bg-background text-xs focus:outline-none focus:border-primary"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleEndorseRequest(req.id)}
                              disabled={endorsingId === req.id}
                              className="px-4 h-8 bg-primary hover:bg-primary/95 text-white font-bold rounded text-xs transition disabled:opacity-50"
                            >
                              {endorsingId === req.id ? 'Endorsing...' : 'Endorse'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Coordinator Cash Advances requests */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">Cash Advances Pending Endorsement</h3>
            {pendingEndorseAdvances.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg p-8 text-center text-xs text-text-muted">
                No coordinator cash advances pending endorsement.
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-background text-text-muted font-semibold uppercase border-b border-border">
                      <th className="px-4 py-3">Coordinator</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Amount Requested</th>
                      <th className="px-4 py-3">Purpose</th>
                      <th className="px-4 py-3">Endorsement Note</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingEndorseAdvances.map(adv => (
                      <tr key={adv.id} className="hover:bg-background/25">
                        <td className="px-4 py-3 font-semibold text-text">{adv.requested_by_name}</td>
                        <td className="px-4 py-3 font-semibold text-navy">{adv.project_name}</td>
                        <td className="px-4 py-3 font-bold text-primary">{formatCurrency(adv.amount_requested_ugx)}</td>
                        <td className="px-4 py-3 text-text-muted max-w-xs truncate" title={adv.purpose}>{adv.purpose}</td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="Optional endorsement note..."
                            value={endorsementNotes[adv.id] || ''}
                            onChange={e => setEndorsementNotes(prev => ({ ...prev, [adv.id]: e.target.value }))}
                            className="w-full h-8 px-2.5 border border-border rounded bg-background text-xs focus:outline-none focus:border-primary"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleEndorseAdvance(adv.id)}
                            disabled={endorsingId === adv.id}
                            className="px-4 h-8 bg-primary hover:bg-primary/95 text-white font-bold rounded text-xs transition disabled:opacity-50"
                          >
                            {endorsingId === adv.id ? 'Endorsing...' : 'Endorse'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
