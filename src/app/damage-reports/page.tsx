"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, DamageReport, User } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  FileText, 
  Wrench, 
  CheckCircle, 
  Trash2, 
  Camera, 
  Upload, 
  X, 
  DollarSign, 
  Calendar, 
  User as UserIcon, 
  MapPin, 
  Info,
  ChevronRight
} from 'lucide-react';

function DamageReportsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportParam = searchParams.get('report');

  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);

  // Form inputs for detail drawer
  const [damageDescription, setDamageDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);

  const fetchReports = async () => {
    try {
      const data = await db.getDamageReports();
      setReports(data);
      
      // If a report parameter is present in URL, auto-select it
      if (reportParam) {
        const found = data.find(r => r.id === reportParam);
        if (found) {
          handleOpenDrawer(found);
        }
      }
    } catch (err) {
      console.error('Error fetching damage reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'pm' || user.role === 'coordinator' || user.role === 'md')) {
      router.push('/dashboard');
      return;
    }
    fetchReports();
  }, [user, router, reportParam]);

  const handleOpenDrawer = (report: DamageReport) => {
    setSelectedReport(report);
    setDamageDescription(report.damage_description || '');
    setEstimatedCost(report.estimated_repair_cost_ugx?.toString() || '');
    setActualCost(report.actual_repair_cost_ugx?.toString() || '');
    setVendorName(report.vendor_name || '');
    setResolutionNotes(report.resolution_notes || '');
    setPhotos(report.photos || []);
  };

  const handleCloseDrawer = () => {
    setSelectedReport(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedReport) return;
    
    setUploading(true);
    try {
      const newUrls: string[] = [...photos];
      for (let i = 0; i < files.length; i++) {
        if (newUrls.length >= 5) {
          alert('Maximum of 5 photos allowed.');
          break;
        }
        const file = files[i];
        if (file.size > 2 * 1024 * 1024) {
          alert(`File ${file.name} exceeds 2MB limit.`);
          continue;
        }

        if (supabase) {
          const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const filePath = `damage-reports/${selectedReport.id}/${filename}`;
          const { data, error } = await supabase.storage
            .from('damage-reports')
            .upload(filePath, file);
          if (error) throw error;
          
          const { data: { publicUrl } } = supabase.storage
            .from('damage-reports')
            .getPublicUrl(filePath);
          newUrls.push(publicUrl);
        } else {
          // Fallback mock photo
          const mockImages = [
            'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=60',
            'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800&auto=format&fit=crop&q=60',
            'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=60'
          ];
          newUrls.push(mockImages[Math.floor(Math.random() * mockImages.length)]);
        }
      }
      setPhotos(newUrls);
      
      // Update photos in database right away
      await db.updateDamageReportStatus(selectedReport.id, selectedReport.status, {
        photos: newUrls
      });
      fetchReports();
    } catch (err: any) {
      console.error('Error uploading photos:', err);
      alert(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (indexToRemove: number) => {
    if (!selectedReport) return;
    const updatedPhotos = photos.filter((_, idx) => idx !== indexToRemove);
    setPhotos(updatedPhotos);
    try {
      await db.updateDamageReportStatus(selectedReport.id, selectedReport.status, {
        photos: updatedPhotos
      });
      fetchReports();
    } catch (err: any) {
      console.error('Failed to remove photo:', err);
    }
  };

  const handleUpdateStatus = async (newStatus: 'open' | 'under_repair' | 'resolved' | 'written_off') => {
    if (!selectedReport || !user) return;

    if (newStatus === 'under_repair' && !vendorName) {
      alert('Repair Vendor Name is required to mark as sent for repair.');
      return;
    }
    if (newStatus === 'resolved' && (!actualCost || !resolutionNotes)) {
      alert('Actual Cost and Resolution Notes are required to resolve a repair.');
      return;
    }

    setDrawerSubmitting(true);
    try {
      const updates: any = {
        damage_description: damageDescription,
        estimated_repair_cost_ugx: estimatedCost ? parseFloat(estimatedCost) : undefined,
        actual_repair_cost_ugx: actualCost ? parseFloat(actualCost) : undefined,
        vendor_name: vendorName || undefined,
        resolved_by: user.id,
        resolution_notes: resolutionNotes || undefined,
        photos
      };

      await db.updateDamageReportStatus(selectedReport.id, newStatus, updates);
      
      // Trigger API Push Dispatch
      try {
        await fetch('/api/push-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            title: `Damage Report Status: ${newStatus.toUpperCase()}`,
            message: `Damage report for ${selectedReport.equipment_asset_code} updated to status "${newStatus}".`,
            link: '/damage-reports'
          })
        });
      } catch (pushErr) {
        console.warn('API push notify trigger failed:', pushErr);
      }

      handleCloseDrawer();
      fetchReports();
    } catch (err: any) {
      alert(err.message || 'Status transition failed');
    } finally {
      setDrawerSubmitting(false);
    }
  };

  const filteredReports = reports.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'under_repair':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'resolved':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'written_off':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open / Logged';
      case 'under_repair': return 'Under Repair';
      case 'resolved': return 'Resolved / Fixed';
      case 'written_off': return 'Written Off / Retired';
      default: return status;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary" />
            Damage Reports
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Log workshop repairs, write off assets, and manage damage photos.
          </p>
        </div>
      </div>

      {/* Filter tab buttons */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: 'all', label: 'All Reports' },
          { id: 'open', label: 'Open' },
          { id: 'under_repair', label: 'Under Repair' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'written_off', label: 'Written Off' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === tab.id
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface text-text hover:bg-background border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-surface animate-pulse border border-border rounded-lg" />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center max-w-md mx-auto">
          <Info className="h-10 w-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-navy">No Damage Reports Found</h3>
          <p className="text-xs text-text-muted mt-1">
            Damage reports are auto-created when assets are returned with conditions other than &quot;Good&quot; during handoff.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-background border-b border-border text-navy font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Report ID</th>
                  <th className="p-4">Asset Code</th>
                  <th className="p-4">Item Name</th>
                  <th className="p-4">Reported At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Est. Repair Cost</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports.map((report) => (
                  <tr 
                    key={report.id}
                    className="hover:bg-background/40 transition-colors"
                  >
                    <td className="p-4 font-mono text-navy font-medium">
                      #{report.id.substring(0, 8)}
                    </td>
                    <td className="p-4 font-semibold text-navy">
                      {report.equipment_asset_code}
                    </td>
                    <td className="p-4 text-text font-medium">
                      {report.equipment_name}
                    </td>
                    <td className="p-4 text-text-muted">
                      {new Date(report.reported_at).toLocaleDateString('en-UG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(report.status)}`}>
                        {getStatusLabel(report.status)}
                      </span>
                    </td>
                    <td className="p-4 text-right font-semibold text-navy">
                      {report.estimated_repair_cost_ugx 
                        ? `${report.estimated_repair_cost_ugx.toLocaleString()} UGX` 
                        : '—'
                      }
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenDrawer(report)}
                        className="h-8 px-3 inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded font-semibold transition-colors"
                      >
                        View &amp; Update
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side Drawer details */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-navy/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-surface h-full flex flex-col shadow-2xl relative animate-slide-in">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border bg-background flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  Damage Report Details
                </span>
                <h2 className="text-base font-bold text-navy mt-0.5">
                  Report #{selectedReport.id.substring(0, 8)}
                </h2>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="h-8 w-8 hover:bg-background rounded-full transition-colors flex items-center justify-center text-text-muted hover:text-navy"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Asset Info Card */}
              <div className="bg-background border border-border rounded-lg p-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Asset Code</span>
                  <span className="font-semibold text-navy">{selectedReport.equipment_asset_code}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Item Name</span>
                  <span className="font-medium text-text">{selectedReport.equipment_name}</span>
                </div>
                <div className="col-span-2 border-t border-border pt-3 mt-1 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-bold flex items-center gap-1">
                      <UserIcon className="h-3 w-3" /> Reported By
                    </span>
                    <span className="font-medium text-text">{selectedReport.reported_by_name}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-bold flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Date Logged
                    </span>
                    <span className="font-medium text-text">
                      {new Date(selectedReport.reported_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Photo Evidence Upload Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-navy uppercase">Photo Evidence (Max 5)</label>
                <div className="grid grid-cols-5 gap-2">
                  {photos.map((url, idx) => (
                    <div key={idx} className="relative aspect-square bg-background border border-border rounded-md overflow-hidden group">
                      <img src={url} alt="Evidence" className="h-full w-full object-cover" />
                      {selectedReport.status !== 'resolved' && selectedReport.status !== 'written_off' && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 h-5 w-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {photos.length < 5 && selectedReport.status !== 'resolved' && selectedReport.status !== 'written_off' && (
                    <label className="aspect-square bg-background border border-dashed border-border rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handleFileUpload} 
                        className="hidden" 
                      />
                      <Camera className="h-4 w-4 text-text-muted group-hover:text-primary mb-1" />
                      <span className="text-[9px] font-bold text-text-muted">Add Photo</span>
                    </label>
                  )}
                </div>
                {uploading && <p className="text-[10px] text-primary animate-pulse font-semibold">Uploading photos...</p>}
              </div>

              {/* Editable Fields Form */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Damage Description *
                  </label>
                  <textarea
                    required
                    disabled={selectedReport.status === 'resolved' || selectedReport.status === 'written_off'}
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary disabled:opacity-60"
                    placeholder="Describe the damages..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Estimated Cost (UGX)
                    </label>
                    <input
                      type="number"
                      disabled={selectedReport.status === 'resolved' || selectedReport.status === 'written_off'}
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      className="w-full h-9 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary disabled:opacity-60"
                      placeholder="e.g. 150000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Repair Vendor Name
                    </label>
                    <input
                      type="text"
                      disabled={selectedReport.status === 'resolved' || selectedReport.status === 'written_off'}
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full h-9 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary disabled:opacity-60"
                      placeholder="e.g. Kampala Workshop"
                    />
                  </div>
                </div>

                {/* Visible when in repair workshop */}
                {(selectedReport.status === 'under_repair' || selectedReport.status === 'resolved' || selectedReport.status === 'written_off') && (
                  <div className="border-t border-border pt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-text mb-1">
                        Actual Cost of Repair (UGX) *
                      </label>
                      <input
                        type="number"
                        required
                        disabled={selectedReport.status === 'resolved' || selectedReport.status === 'written_off'}
                        value={actualCost}
                        onChange={(e) => setActualCost(e.target.value)}
                        className="w-full h-9 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary disabled:opacity-60"
                        placeholder="e.g. 145000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text mb-1">
                        Resolution Notes *
                      </label>
                      <textarea
                        required
                        disabled={selectedReport.status === 'resolved' || selectedReport.status === 'written_off'}
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        rows={3}
                        className="w-full p-2.5 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary disabled:opacity-60"
                        placeholder="Detail the repairs done..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-border bg-background flex flex-col gap-2">
              {selectedReport.status === 'open' && user?.role === 'warehouse_manager' && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('under_repair')}
                  disabled={drawerSubmitting || !vendorName}
                  className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Wrench className="h-4 w-4" />
                  Send for Repair (Vendor Required)
                </button>
              )}

              {selectedReport.status === 'under_repair' && (
                <div className="flex flex-col gap-2">
                  {user?.role === 'warehouse_manager' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('resolved')}
                      disabled={drawerSubmitting || !actualCost || !resolutionNotes}
                      className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Mark Repaired &amp; Return to Inventory
                    </button>
                  )}

                  {user?.role === 'cfo' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('written_off')}
                      disabled={drawerSubmitting}
                      className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Write Off / Retire Asset
                    </button>
                  )}
                </div>
              )}

              {/* Resolved or Written off details */}
              {(selectedReport.status === 'resolved' || selectedReport.status === 'written_off') && (
                <div className="p-3 bg-background border border-border rounded-md text-xs text-text-muted flex items-start gap-2">
                  <Info className="h-4 w-4 text-navy mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-navy block uppercase text-[10px]">
                      Report Closed
                    </span>
                    This report was marked as <strong className="text-text font-medium">{getStatusLabel(selectedReport.status)}</strong> on {selectedReport.resolved_at ? new Date(selectedReport.resolved_at).toLocaleDateString() : '—'}. No further actions can be taken.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DamageReportsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-12 bg-surface animate-pulse border border-border rounded-lg" />
        <div className="h-64 bg-surface animate-pulse border border-border rounded-lg" />
      </div>
    }>
      <DamageReportsContent />
    </Suspense>
  );
}
