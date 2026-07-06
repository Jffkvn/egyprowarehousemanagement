"use client";

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Request, RequestItem, Equipment } from '@/lib/db';
import { StatusBadge } from '@/components/dashboard/PMDashboard';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  User, 
  AlertCircle, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  ShoppingBag,
  History,
  RotateCcw,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RequestDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval/Rejection states
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Changes requested states
  const [changesNote, setChangesNote] = useState('');
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [endorsement, setEndorsement] = useState<any | null>(null);
  const [parentRequest, setParentRequest] = useState<Request | null>(null);

  // Return logging states
  const [activeReturnItemId, setActiveReturnItemId] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState<'good' | 'damaged' | 'missing_parts' | 'non_functional'>('good');
  const [returnNotes, setReturnNotes] = useState('');

  // Stock availability checklist
  const [stockStatus, setStockStatus] = useState<Record<string, { available: boolean; currentStock: number }>>({});

  const fetchRequestDetails = async () => {
    try {
      const allRequests = await db.getRequests();
      const req = allRequests.find(r => r.id === id);
      if (!req) {
        setError('Request not found');
        return;
      }
      setRequest(req);

      // Load PM endorsement if any
      const end = await db.getRequestEndorsement(req.id);
      setEndorsement(end);

      // Load parent request if revision
      if (req.parent_id) {
        const parent = allRequests.find(r => r.id === req.parent_id);
        if (parent) setParentRequest(parent);
      }

      // Verify live stock availability for pending requests
      if (req.status === 'pending') {
        const eqCatalog = await db.getEquipment();
        const conCatalog = await db.getConsumables();
        const availability: Record<string, { available: boolean; currentStock: number }> = {};

        req.items?.forEach(item => {
          if (item.equipment_id) {
            const eq = eqCatalog.find(e => e.id === item.equipment_id);
            availability[item.id] = {
              available: eq ? eq.status === 'available' : false,
              currentStock: eq && eq.status === 'available' ? 1 : 0
            };
          } else if (item.consumable_id) {
            const con = conCatalog.find(c => c.id === item.consumable_id);
            const stockQty = con ? con.quantity_on_hand : 0;
            availability[item.id] = {
              available: stockQty >= item.quantity_requested,
              currentStock: stockQty
            };
          }
        });
        setStockStatus(availability);
      }
    } catch (err) {
      console.error('Error fetching request details:', err);
      setError('Failed to load request details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [id]);

  const handleApprove = async () => {
    if (!user || !request) return;
    setActionLoading(true);
    try {
      await db.approveRequest(request.id, user.id);
      await fetchRequestDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !request) return;
    if (!rejectionReason.trim()) {
      alert('Rejection reason is required.');
      return;
    }
    setActionLoading(true);
    try {
      await db.rejectRequest(request.id, user.id, rejectionReason);
      setRejecting(false);
      setRejectionReason('');
      await fetchRequestDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !request) return;
    if (!changesNote.trim()) {
      alert('Changes request note is required.');
      return;
    }
    setActionLoading(true);
    try {
      await db.requestChangesOnRequest(request.id, changesNote);
      setRequestingChanges(false);
      setChangesNote('');
      await fetchRequestDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to request changes');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!user || !request) return;
    setActionLoading(true);
    try {
      await db.checkoutRequest(request.id, user.id);
      await fetchRequestDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to checkout equipment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent, eqId: string) => {
    e.preventDefault();
    if (!user || !request) return;
    setActionLoading(true);
    try {
      await db.returnRequestItem(request.id, eqId, returnCondition, returnNotes, user.id);
      setActiveReturnItemId(null);
      setReturnNotes('');
      setReturnCondition('good');
      await fetchRequestDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to log equipment return');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h3 className="text-base font-semibold text-navy mb-1">{error || 'Something went wrong'}</h3>
        <button 
          onClick={() => router.back()}
          className="mt-4 inline-flex items-center space-x-2 text-primary text-sm font-semibold"
        >
          <ArrowLeft size={16} />
          <span>Go Back</span>
        </button>
      </div>
    );
  }

  const isWM = user?.role === 'warehouse_manager';
  const isCFO = user?.role === 'cfo';
  const isApprover = isCFO || (isWM && request.routed_to === 'warehouse_manager');
  const hasInsufficientStock = Object.values(stockStatus).some(status => !status.available);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center space-x-2 text-text-muted hover:text-navy text-xs font-semibold transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to list</span>
        </button>
      </div>

      {/* Main Request Card */}
      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Card Header Banner */}
        <div className="p-6 border-b border-border bg-background/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-text-muted font-semibold uppercase tracking-wider">Request ID: {request.id.substr(0, 8)}</div>
            <h2 className="text-xl font-bold text-navy mt-1">{request.project_name}</h2>
            <div className="flex items-center space-x-4 mt-2 text-xs text-text-muted font-medium">
              <span className="flex items-center">
                <User size={12} className="mr-1 text-primary" />
                PM: {request.requested_by_name}
              </span>
              {request.site_location && (
                <span className="flex items-center">
                  <MapPin size={12} className="mr-1 text-primary" />
                  Site: {request.site_location}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1.5">
            <StatusBadge status={request.status} />
            <span className="text-[10px] text-text-muted font-mono">
              Routed to: {request.routed_to === 'cfo' ? 'CFO' : 'Warehouse Manager'}
            </span>
          </div>
        </div>

      {request.status === 'pending' && (
        <div className="mx-6 mt-4 p-3 bg-warning-tint border border-warning/20 text-warning rounded-md text-xs font-semibold flex items-center space-x-2">
          <Clock size={16} />
          <span>Currently awaiting review by: <strong className="text-navy">{request.routed_to === 'cfo' ? 'CFO (High-Value / Low-Stock routing)' : 'Warehouse Manager'}</strong></span>
        </div>
      )}

        {/* Card Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Details Column */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Timeline Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-background border border-border rounded-md">
                  <div className="text-[10px] text-text-muted font-semibold uppercase">Needed From</div>
                  <div className="text-sm font-semibold text-navy flex items-center mt-1">
                    <Calendar size={14} className="mr-1.5 text-primary" />
                    {request.needed_from}
                  </div>
                </div>
                <div className="p-3 bg-background border border-border rounded-md">
                  <div className="text-[10px] text-text-muted font-semibold uppercase">Needed Until</div>
                  <div className="text-sm font-semibold text-navy flex items-center mt-1">
                    <Calendar size={14} className="mr-1.5 text-primary" />
                    {request.needed_until || 'Consumables Only'}
                  </div>
                </div>
              </div>
            </div>

            {/* Requested Items List */}
            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Requested Line Items</h3>
              <div className="border border-border rounded-md overflow-hidden bg-background">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface text-text-muted border-b border-border font-semibold uppercase">
                      <th className="px-4 py-2.5">Item Details</th>
                      <th className="px-4 py-2.5">Asset/SKU Code</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Qty Requested</th>
                      {request.status === 'pending' && (isWM || isCFO) && (
                        <th className="px-4 py-2.5">Stock Check</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {request.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-text">{item.name}</div>
                          <div className="text-[10px] text-text-muted">Unit Value: {parseFloat((item.unit_value_ugx || 0).toString()).toLocaleString()} UGX</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-text-muted">{item.asset_code || item.sku_code || '—'}</td>
                        <td className="px-4 py-3 capitalize">{item.item_type}</td>
                        <td className="px-4 py-3 font-semibold">{item.quantity_requested} unit{item.quantity_requested > 1 ? 's' : ''}</td>
                        {request.status === 'pending' && (isWM || isCFO) && (
                          <td className="px-4 py-3">
                            {stockStatus[item.id]?.available ? (
                              <span className="text-success font-semibold flex items-center">
                                <Check size={12} className="mr-1" />
                                Available
                              </span>
                            ) : (
                              <span className="text-danger font-semibold flex items-center">
                                <AlertCircle size={12} className="mr-1" />
                                Out of Stock ({stockStatus[item.id]?.currentStock || 0})
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PM Endorsement */}
            {endorsement && (
              <div className="p-4 border rounded-lg bg-primary/5 border-primary/25 space-y-2">
                <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Project Manager Endorsement
                </h4>
                <p className="text-xs text-text italic">"{endorsement.note || 'Endorsed without comment.'}"</p>
                <div className="text-[10px] text-text-muted">
                  Endorsed on {new Date(endorsement.created_at).toLocaleDateString()}
                </div>
              </div>
            )}

            {/* Revision History Comparison Panel */}
            {parentRequest && (
              <div className="border border-border rounded-lg overflow-hidden bg-background/30 space-y-0">
                <div className="p-3 bg-background/50 border-b border-border flex justify-between items-center">
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider">
                    Revision History (Revision {request.revision_number || 1})
                  </h4>
                  <span className="px-2 py-0.5 bg-neutral-tint text-text rounded text-[9px] font-semibold border border-border">
                    Active Revision
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <h5 className="font-semibold text-text-muted mb-2 uppercase text-[10px]">Previous Version (Revision {(request.revision_number || 2) - 1})</h5>
                    <div className="space-y-1 bg-surface p-2.5 rounded border border-border">
                      <div><span className="font-medium text-text-muted">Needed From:</span> {parentRequest.needed_from}</div>
                      <div><span className="font-medium text-text-muted">Needed Until:</span> {parentRequest.needed_until || 'Consumables Only'}</div>
                      <div><span className="font-medium text-text-muted">Status:</span> <span className="capitalize">{parentRequest.status}</span></div>
                      {parentRequest.reviewer_note && (
                        <div className="mt-2 text-danger bg-danger-tint p-1.5 rounded border border-danger/10 text-[10px]">
                          <span className="font-bold">Reviewer Note:</span> {parentRequest.reviewer_note}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h5 className="font-semibold text-text-muted mb-2 uppercase text-[10px]">Current Version (Revision {request.revision_number})</h5>
                    <div className="space-y-1 bg-surface p-2.5 rounded border border-border">
                      <div><span className="font-medium text-text-muted">Needed From:</span> {request.needed_from}</div>
                      <div><span className="font-medium text-text-muted">Needed Until:</span> {request.needed_until || 'Consumables Only'}</div>
                      <div><span className="font-medium text-text-muted">Status:</span> <span className="capitalize">{request.status}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection reason banner */}
            {request.status === 'rejected' && request.rejection_reason && (
              <div className="p-4 bg-danger-tint border border-danger/25 text-danger rounded-md text-sm">
                <div className="font-bold text-xs uppercase tracking-wider mb-1">Rejection Reason:</div>
                <p className="font-medium">{request.rejection_reason}</p>
              </div>
            )}

            {/* Changes requested banner */}
            {request.status === 'changes_requested' && request.reviewer_note && (
              <div className="p-4 bg-warning-tint border border-warning/25 text-warning rounded-md text-sm">
                <div className="font-bold text-xs uppercase tracking-wider mb-1 text-navy">Changes Requested:</div>
                <p className="font-medium text-text">{request.reviewer_note}</p>
              </div>
            )}
          </div>

          {/* Action Context Column */}
          <div className="bg-background/20 border-l border-border p-6 md:p-4 space-y-6">
            {/* 1. Pending Approvals Panel (WM / CFO) */}
            {request.status === 'pending' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Approval Verification</h4>
                
                {!isApprover ? (
                  <div className="p-3 bg-neutral-tint text-text border border-border rounded text-xs">
                    This request is currently routed to <strong>{request.routed_to === 'cfo' ? 'CFO' : 'Warehouse Manager'}</strong> for approval.
                  </div>
                ) : (
                  <>
                    {hasInsufficientStock && (
                      <div className="p-3 bg-danger-tint border border-danger/20 text-danger rounded text-xs font-medium flex items-start">
                        <AlertCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                        <span>Warning: One or more requested items are currently out of stock. Approving will queue fulfillment.</span>
                      </div>
                    )}

                    {!rejecting && !requestingChanges ? (
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-md transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
                        >
                          <ThumbsUp size={14} />
                          <span>Approve Request</span>
                        </button>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setRequestingChanges(true)}
                            disabled={actionLoading}
                            className="w-full h-9 border border-warning text-warning hover:bg-warning/5 font-semibold text-xs rounded-md transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                          >
                            <span>Request Changes</span>
                          </button>
                          <button
                            onClick={() => setRejecting(true)}
                            disabled={actionLoading}
                            className="w-full h-9 border border-danger text-danger hover:bg-danger/5 font-semibold text-xs rounded-md transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                          >
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ) : rejecting ? (
                      <form onSubmit={handleReject} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-text mb-1">
                            Rejection Reason <span className="text-danger">*</span>
                          </label>
                          <textarea
                            required
                            rows={3}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Provide rejection reason..."
                            className="w-full p-2 border border-border bg-surface rounded text-xs focus:outline-none focus:border-primary resize-none"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            disabled={actionLoading}
                            className="flex-1 h-8 bg-danger text-white hover:bg-danger/95 text-xs font-semibold rounded transition-colors"
                          >
                            Submit Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejecting(false);
                              setRejectionReason('');
                            }}
                            className="px-3 h-8 border border-border text-text hover:bg-background text-xs font-semibold rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleRequestChanges} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-text mb-1">
                            Requested Changes Description <span className="text-danger">*</span>
                          </label>
                          <textarea
                            required
                            rows={3}
                            value={changesNote}
                            onChange={(e) => setChangesNote(e.target.value)}
                            placeholder="Detail what needs to be changed..."
                            className="w-full p-2 border border-border bg-surface rounded text-xs focus:outline-none focus:border-primary resize-none"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            disabled={actionLoading}
                            className="flex-1 h-8 bg-warning text-navy font-bold hover:bg-warning/95 text-xs rounded transition-colors"
                          >
                            Submit Request
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRequestingChanges(false);
                              setChangesNote('');
                            }}
                            className="px-3 h-8 border border-border text-text hover:bg-background text-xs font-semibold rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 2. Approved -> Fulfill Checkout Panel (WM only) */}
            {request.status === 'approved' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Handoff Fulfillment</h4>
                
                {isWM ? (
                  <div className="space-y-3">
                    <p className="text-xs text-text-muted">
                      Equipment has been approved. Confirm that physical items have been picked and handed over to the PM.
                    </p>
                    <button
                      onClick={handleCheckout}
                      disabled={actionLoading}
                      className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-md transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <ShoppingBag size={14} />
                      <span>Confirm Handoff (Checkout)</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-tint text-text border border-border rounded text-xs">
                    Awaiting Warehouse Manager to perform the physical checkout of these approved items.
                  </div>
                )}
              </div>
            )}

            {/* 3. Fulfilled -> Return Equipment Log Panel (WM only) */}
            {request.status === 'fulfilled' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Log Returns (Reusable)</h4>
                
                {isWM ? (
                  <div className="space-y-4">
                    <p className="text-xs text-text-muted">
                      Log returned reusable equipment as they are received back in the warehouse.
                    </p>

                    {request.items?.filter(i => i.item_type === 'reusable').length === 0 ? (
                      <div className="text-xs text-text-muted italic bg-background p-2 rounded">
                        This request contains only consumables. No returns required.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {request.items
                          ?.filter(i => i.item_type === 'reusable')
                          .map((item) => {
                            const isReturned = item.equipment_id ? 
                              stockStatus[item.id]?.available : false; 
                            // Note: if available, it means it returned (since checkout makes it checked_out, return makes it available).
                            // Wait, checking status of specific physical unit is safer.
                            
                            return (
                              <div key={item.id} className="border border-border bg-surface p-2.5 rounded-md text-xs space-y-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-semibold text-text">{item.name}</div>
                                    <div className="font-mono text-[10px] text-text-muted">{item.asset_code}</div>
                                  </div>
                                </div>

                                {activeReturnItemId === item.id ? (
                                  <form onSubmit={(e) => handleReturnSubmit(e, item.equipment_id || '')} className="space-y-2.5 pt-2 border-t border-border">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-text mb-0.5">Condition</label>
                                      <select
                                        value={returnCondition}
                                        onChange={(e) => setReturnCondition(e.target.value as any)}
                                        className="w-full h-8 px-2 border border-border bg-background rounded text-xs focus:outline-none focus:border-primary"
                                      >
                                        <option value="good">Good (Available)</option>
                                        <option value="damaged">Damaged (Needs Repair)</option>
                                        <option value="missing_parts">Missing Parts (Needs Repair)</option>
                                        <option value="non_functional">Non-Functional (Needs Repair)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold text-text mb-0.5">Return Notes</label>
                                      <input
                                        type="text"
                                        value={returnNotes}
                                        onChange={(e) => setReturnNotes(e.target.value)}
                                        placeholder="e.g. Scratched but functional"
                                        className="w-full h-8 px-2 border border-border bg-background rounded text-xs focus:outline-none"
                                      />
                                    </div>
                                    <div className="flex space-x-1.5">
                                      <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="flex-1 h-7 bg-primary text-white text-xs font-semibold rounded"
                                      >
                                        Save Log
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveReturnItemId(null)}
                                        className="px-2 h-7 border border-border text-xs rounded"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setActiveReturnItemId(item.id);
                                      // We can double check if it is already returned by fetching its actual live db status
                                    }}
                                    className="w-full h-8 border border-navy/20 hover:bg-navy/5 text-navy font-semibold rounded text-xs transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <RotateCcw size={12} />
                                    <span>Log Return Details</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-tint text-text border border-border rounded text-xs">
                    Items are currently checked out. Warehouse manager will log equipment returns here when they arrive.
                  </div>
                )}
              </div>
            )}

            {/* 4. Complete / Returned Panel */}
            {request.status === 'returned' && (
              <div className="p-4 bg-success-tint border border-success/20 rounded-lg text-center space-y-2">
                <CheckCircle2 size={32} className="text-success mx-auto" />
                <h4 className="font-bold text-navy text-xs uppercase tracking-wider">Cycle Completed</h4>
                <p className="text-xs text-text-muted">
                  All checked out equipment from this project request have been returned to warehouse inventory.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
