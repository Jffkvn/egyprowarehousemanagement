"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db, Project, DailyUpdate, ProjectAssignment } from '@/lib/db';
import { FileText, Calendar, Plus, BookOpen, Clock, CheckCircle, AlertCircle, Camera, User, Briefcase } from 'lucide-react';

export default function DailyUpdatesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [updateDate, setUpdateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');

  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Authenticate & load data
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Check permission: coordinator, pm, cfo, md
    if (!['coordinator', 'pm', 'cfo', 'md'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    loadInitialData();
  }, [user, router]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Load projects
      const allProjects = await db.getProjects();
      const activeProjects = allProjects.filter(p => p.status === 'active');

      if (user?.role === 'coordinator') {
        // Only load projects the coordinator is assigned to
        const assignments = await db.getProjectAssignments();
        const coordinatorAssignments = assignments.filter(
          (a: ProjectAssignment) => a.user_id === user.id && !a.unassigned_at
        );
        const assignedProjIds = coordinatorAssignments.map(a => a.project_id);
        const assignedProjects = activeProjects.filter(p => assignedProjIds.includes(p.id));
        
        setProjects(assignedProjects);
        if (assignedProjects.length > 0) {
          setSelectedProjectId(assignedProjects[0].id);
        }
      } else {
        // PM, CFO, MD see all active projects
        setProjects(activeProjects);
        if (activeProjects.length > 0) {
          setSelectedProjectId(activeProjects[0].id);
        }
      }

      // Load updates
      await refreshUpdatesList();

    } catch (err: any) {
      console.error('Error loading daily updates dashboard:', err);
      setErrorMsg('Failed to load project details.');
    } finally {
      setLoading(false);
    }
  };

  const refreshUpdatesList = async () => {
    try {
      const allUpdates = await db.getDailyUpdates();
      
      if (user?.role === 'coordinator') {
        // Coordinator only sees their own updates
        const filtered = allUpdates.filter(u => u.submitted_by === user.id);
        setUpdates(filtered);
      } else if (user?.role === 'pm') {
        // PM supervisor sees updates for their assigned projects
        const assignments = await db.getProjectAssignments();
        const pmProjIds = assignments
          .filter((a: ProjectAssignment) => a.user_id === user.id && !a.unassigned_at)
          .map(a => a.project_id);
        
        const filtered = allUpdates.filter(u => pmProjIds.includes(u.project_id));
        setUpdates(filtered);
      } else {
        // CFO & MD see all updates
        setUpdates(allUpdates);
      }
    } catch (err) {
      console.error('Error loading updates history:', err);
    }
  };

  const handleAddPhoto = () => {
    if (!newPhotoUrl) return;
    setPhotos(prev => [...prev, newPhotoUrl]);
    setNewPhotoUrl('');
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleMockUpload = () => {
    const mockBlob = `blob:https://egypro-update-photo-${Math.floor(Math.random() * 1000)}`;
    setPhotos(prev => [...prev, mockBlob]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!selectedProjectId) {
      setErrorMsg('Please select a project.');
      return;
    }
    if (!summary.trim()) {
      setErrorMsg('Please provide an update summary description.');
      return;
    }
    if (!updateDate) {
      setErrorMsg('Please select a valid update date.');
      return;
    }

    try {
      setErrorMsg(null);
      setSuccessMsg(null);

      await db.createDailyUpdate({
        project_id: selectedProjectId,
        submitted_by: user.id,
        update_date: updateDate,
        summary: summary.trim(),
        photo_urls: photos
      });

      setSuccessMsg('Daily update submitted successfully!');
      setSummary('');
      setPhotos([]);
      
      await refreshUpdatesList();
    } catch (err: any) {
      console.error('Error submitting daily update:', err);
      if (err.message && err.message.includes('unique_project_user_date')) {
        setErrorMsg('An update has already been logged for this project and date today.');
      } else {
        setErrorMsg(err.message || 'Failed to submit daily update.');
      }
    }
  };

  const filteredUpdates = updates.filter(u => {
    if (filterProjectId === 'all') return true;
    return u.project_id === filterProjectId;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Daily Field Updates
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            {user?.role === 'coordinator' 
              ? 'Submit daily field status reports and progress summaries for your assigned projects.' 
              : 'Monitor field status updates, site logs, and coordinator reports across operations.'}
          </p>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="flex items-center gap-3 p-3 text-xs font-medium text-success bg-success-tint border border-success/15 rounded-md">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-success hover:text-text">&times;</button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 p-3 text-xs font-medium text-danger bg-danger-tint border border-danger/15 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-danger hover:text-text">&times;</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* submission form (Coordinators only) */}
        {user?.role === 'coordinator' && (
          <div className="lg:col-span-1 bg-surface border border-border rounded-lg overflow-hidden shadow-sm h-fit">
            <div className="p-4 border-b border-border bg-background/50">
              <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Submit Update Log
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Project select */}
              <div>
                <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">
                  Assigned Project
                </label>
                {projects.length === 0 ? (
                  <div className="p-3 text-xs text-danger bg-danger-tint border border-danger/10 rounded-md">
                    No active project assignments. Please contact your CFO.
                  </div>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">
                  Update Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-text-muted" />
                  <input
                    type="date"
                    value={updateDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setUpdateDate(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">
                  Progress Summary & Site Log
                </label>
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  placeholder="Enter details on work completed, delays encountered, material status, etc..."
                  rows={6}
                  className="w-full p-3 bg-background border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Photos */}
              <div>
                <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1 flex justify-between items-center">
                  <span>Photo Attachments</span>
                  <button 
                    type="button" 
                    onClick={handleMockUpload}
                    className="text-[10px] text-primary hover:text-primary-hover font-bold flex items-center gap-0.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Mock Capture
                  </button>
                </label>
                
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newPhotoUrl}
                    onChange={e => setNewPhotoUrl(e.target.value)}
                    placeholder="Paste image URL (optional)"
                    className="flex-1 h-9 px-3 bg-background border border-border rounded text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhoto}
                    className="h-9 px-3 bg-navy hover:bg-navy/95 text-white font-bold text-xs rounded transition"
                  >
                    Add
                  </button>
                </div>

                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 border border-border rounded bg-background/25">
                    {photos.map((url, idx) => (
                      <div key={idx} className="relative group w-14 h-14 border border-border rounded overflow-hidden">
                        <div className="w-full h-full flex flex-col items-center justify-center bg-navy/5 text-[8px] font-mono text-center text-text-muted p-1">
                          Photo {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute inset-0 bg-danger/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[10px] font-bold"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={projects.length === 0}
                className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-md transition shadow-sm mt-2 disabled:bg-neutral-tint disabled:text-text-muted disabled:cursor-not-allowed"
              >
                Submit Daily Update
              </button>
            </form>
          </div>
        )}

        {/* History log (takes full width if not coordinator) */}
        <div className={`bg-surface border border-border rounded-lg overflow-hidden shadow-sm ${
          user?.role === 'coordinator' ? 'lg:col-span-2' : 'lg:col-span-3'
        }`}>
          <div className="p-4 border-b border-border bg-background/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Daily Update Logs
            </h2>

            {/* Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-[10px] font-bold text-text uppercase tracking-wider whitespace-nowrap">Filter Project:</label>
              <select
                value={filterProjectId}
                onChange={e => setFilterProjectId(e.target.value)}
                className="h-8 px-2 bg-background border border-border rounded text-xs focus:outline-none"
              >
                <option value="all">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-border overflow-y-auto max-h-[600px]">
            {filteredUpdates.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No daily updates logged for the current selection.
              </div>
            ) : (
              filteredUpdates.map((up) => (
                <div key={up.id} className="p-4 space-y-3 hover:bg-background/25 transition">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-navy">{up.project_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {up.update_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {up.submitted_by_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(up.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-text leading-relaxed whitespace-pre-wrap pl-6 font-normal">
                    {up.summary}
                  </p>

                  {up.photo_urls && up.photo_urls.length > 0 && (
                    <div className="flex gap-2 pl-6 pt-1">
                      {up.photo_urls.map((photo, pIdx) => (
                        <div key={pIdx} className="w-16 h-16 border border-border rounded overflow-hidden bg-background/50 flex flex-col items-center justify-center text-[8px] font-mono text-text-muted p-1">
                          <span>Attached</span>
                          <span>Photo {pIdx + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
