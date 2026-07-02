"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Request } from '@/lib/db';
import Link from 'next/link';
import { PlusCircle, Search, Calendar, MapPin, Eye, Package } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      if (!user) return;
      try {
        const allRequests = await db.getRequests();
        // Filter PM's own requests
        const ownRequests = allRequests.filter(r => r.requested_by === user.id);
        setRequests(ownRequests);
      } catch (err) {
        console.error('Error fetching PM requests:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [user]);

  const filteredRequests = requests.filter(r => 
    r.project_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.site_location && r.site_location.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">My Equipment Requests</h2>
          <p className="text-sm text-text-muted">Track logistics requests for your project sites</p>
        </div>
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
                  <th className="px-6 py-3">Project Name & Site</th>
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
                          <span className="text-text-muted text-xs">Consumables Only</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={req.status} />
                        {req.status === 'pending' && (
                          <div className="text-[10px] text-text-muted mt-1 font-mono">
                            Routed to: {req.routed_to === 'cfo' ? 'CFO' : 'Warehouse Mgr'}
                          </div>
                        )}
                        {req.status === 'rejected' && req.rejection_reason && (
                          <div className="text-[10px] text-danger max-w-[150px] truncate mt-1" title={req.rejection_reason}>
                            Reason: {req.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-text-muted">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                        <Link 
                          href={`/requests/${req.id}`}
                          className="inline-flex items-center space-x-1.5 text-navy border border-navy/20 hover:bg-navy/5 rounded px-2.5 h-8 font-medium transition-colors"
                        >
                          <Eye size={12} />
                          <span>View Details</span>
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
  );
}
