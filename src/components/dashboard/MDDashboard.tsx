"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Project, DailyUpdate, CashAdvance, Request, ProjectAssignment, User } from '@/lib/db';
import { StatusBadge } from './PMDashboard';
import { Briefcase, Coins, FileText, Users, AlertTriangle, CheckCircle, TrendingUp, Edit2, ChevronRight, X, Calendar } from 'lucide-react';

export default function MDDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [missedUpdates, setMissedUpdates] = useState<Array<{ project_id: string; project_name: string; user_id: string; user_full_name: string }>>([]);

  // Budget Modal State
  const [selectedProj, setSelectedProj] = useState<Project | null>(null);
  const [budgetVal, setBudgetVal] = useState<string>('');
  const [budgetNotes, setBudgetNotes] = useState<string>('');
  const [submittingBudget, setSubmittingBudget] = useState(false);
  const [budgetSuccess, setBudgetSuccess] = useState(false);

  useEffect(() => {
    loadMDDashboardData();
  }, []);

  const loadMDDashboardData = async () => {
    try {
      setLoading(true);
      
      const allProjects = await db.getProjects();
      const allUpdates = await db.getDailyUpdates();
      const allAdvances = await db.getCashAdvances('md', user?.id || '');
      const allRequests = await db.getRequests();
      
      // Load yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const missed = await db.checkMissedDailyUpdates(yesterdayStr);

      setProjects(allProjects);
      setUpdates(allUpdates.slice(0, 5)); // show recent 5
      setAdvances(allAdvances);
      setRequests(allRequests);
      setMissedUpdates(missed);

    } catch (err) {
      console.error('Error loading MD Dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBudgetModal = (proj: Project) => {
    setSelectedProj(proj);
    setBudgetVal((proj.estimated_budget_ugx || 0).toString());
    setBudgetNotes(proj.budget_notes || '');
    setBudgetSuccess(false);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !user) return;

    try {
      setSubmittingBudget(true);
      const parsedBudget = Number(budgetVal);
      if (isNaN(parsedBudget) || parsedBudget < 0) {
        alert('Please enter a valid budget amount.');
        return;
      }

      await db.updateProjectBudget(selectedProj.id, parsedBudget, budgetNotes, user.id);
      
      // Refresh local projects list
      setProjects(prev => prev.map(p => p.id === selectedProj.id ? {
        ...p,
        estimated_budget_ugx: parsedBudget,
        budget_notes: budgetNotes,
        budget_set_by: user.id
      } : p));

      setBudgetSuccess(true);
      setTimeout(() => {
        setSelectedProj(null);
      }, 1000);
    } catch (err) {
      console.error('Error setting project budget:', err);
      alert('Failed to set advisory budget.');
    } finally {
      setSubmittingBudget(false);
    }
  };

  // Helper calculation
  const totalBudget = projects.reduce((sum, p) => sum + (p.estimated_budget_ugx || 0), 0);
  
  // Disbursed cash advances sum
  const totalDisbursed = advances
    .filter(a => ['disbursed', 'partially_retired', 'retired', 'overdue'].includes(a.status))
    .reduce((sum, a) => sum + (a.amount_disbursed_ugx || a.amount_requested_ugx), 0);

  const pendingAdvancesCount = advances.filter(a => a.status === 'pending').length;
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="p-4 bg-surface border border-border rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total Projects</span>
            <h3 className="text-xl font-bold text-navy mt-0.5">{projects.length}</h3>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-4 bg-surface border border-border rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-3 bg-success/10 rounded-lg text-success">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total Disbursed</span>
            <h3 className="text-xl font-bold text-navy mt-0.5">{totalDisbursed.toLocaleString()} UGX</h3>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-4 bg-surface border border-border rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-3 bg-warning/10 rounded-lg text-warning">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Pending Tasks</span>
            <h3 className="text-xl font-bold text-navy mt-0.5">
              {pendingRequestsCount + pendingAdvancesCount}
              <span className="text-[10px] text-text-muted font-normal ml-1">({pendingRequestsCount} tools, {pendingAdvancesCount} cash)</span>
            </h3>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-4 bg-surface border border-border rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-3 bg-danger/10 rounded-lg text-danger">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Missed Updates (Yesterday)</span>
            <h3 className="text-xl font-bold text-navy mt-0.5">{missedUpdates.length}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Project Health Table */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-background/50 flex justify-between items-center">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-primary" />
              Project Health & Budget Allocations
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="p-3 text-[10px] font-bold text-text uppercase tracking-wider">Project Name</th>
                  <th className="p-3 text-[10px] font-bold text-text uppercase tracking-wider">Advisory Budget</th>
                  <th className="p-3 text-[10px] font-bold text-text uppercase tracking-wider">Actual Spent</th>
                  <th className="p-3 text-[10px] font-bold text-text uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {projects.map((proj) => {
                  const projDisbursed = advances
                    .filter(a => a.project_id === proj.id && ['disbursed', 'partially_retired', 'retired', 'overdue'].includes(a.status))
                    .reduce((sum, a) => sum + (a.amount_disbursed_ugx || a.amount_requested_ugx), 0);

                  const overBudget = projDisbursed > (proj.estimated_budget_ugx || 0);

                  return (
                    <tr key={proj.id} className="hover:bg-background/25">
                      <td className="p-3">
                        <div className="font-bold text-navy">{proj.name}</div>
                        <div className="text-[10px] text-text-muted">{proj.site_location}</div>
                      </td>
                      <td className="p-3 font-semibold text-navy">
                        {(proj.estimated_budget_ugx || 0).toLocaleString()} UGX
                      </td>
                      <td className="p-3">
                        <span className={`font-semibold ${overBudget ? 'text-danger' : 'text-text'}`}>
                          {projDisbursed.toLocaleString()} UGX
                        </span>
                        {overBudget && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-danger-tint text-danger rounded text-[9px] font-semibold border border-danger/10">
                            Over Budget
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenBudgetModal(proj)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-primary hover:text-primary-hover font-bold hover:bg-primary/5 rounded border border-primary/20 transition"
                        >
                          <Edit2 className="w-3 h-3" />
                          Set Budget
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Missed Field Updates Alert Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-background/50">
              <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-danger animate-pulse" />
                Missed Updates (Yesterday)
              </h2>
            </div>
            <div className="p-4 divide-y divide-border max-h-[300px] overflow-y-auto">
              {missedUpdates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-text-muted">
                  <CheckCircle className="w-8 h-8 text-success mb-2" />
                  All coordinators logged their field updates yesterday.
                </div>
              ) : (
                missedUpdates.map((m, idx) => (
                  <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-navy">{m.user_full_name}</div>
                      <div className="text-[10px] text-text-muted">{m.project_name}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-danger-tint text-danger font-semibold border border-danger/15 rounded text-[9px]">
                      Missed update
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Daily Updates Stream */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-background/50">
              <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-primary" />
                Recent Updates Feed
              </h2>
            </div>
            <div className="p-4 divide-y divide-border max-h-[400px] overflow-y-auto">
              {updates.length === 0 ? (
                <div className="py-6 text-center text-xs text-text-muted">
                  No daily updates logged yet.
                </div>
              ) : (
                updates.map((up) => (
                  <div key={up.id} className="py-3 space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-navy">{up.project_name}</span>
                      <span className="text-text-muted">{up.update_date}</span>
                    </div>
                    <p className="text-[11px] text-text line-clamp-3">
                      {up.summary}
                    </p>
                    <div className="text-[9px] text-text-muted font-medium flex items-center gap-1">
                      <Users className="w-3 h-3 text-text-muted" />
                      <span>Logged by {up.submitted_by_name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Set Advisory Budget Modal */}
      {selectedProj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border bg-background/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-navy">Set Project Advisory Budget</h3>
              <button 
                onClick={() => setSelectedProj(null)}
                className="p-1 text-text-muted hover:text-text rounded-md hover:bg-neutral-tint transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="p-4 space-y-4">
              {budgetSuccess ? (
                <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 text-success">
                  <CheckCircle className="w-12 h-12" />
                  <p className="text-xs font-bold">Advisory budget updated successfully!</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      disabled
                      value={selectedProj.name}
                      className="w-full h-10 px-3 bg-neutral-tint border border-border rounded-md text-xs text-text-muted cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">
                      Estimated Advisory Budget (UGX)
                    </label>
                    <input
                      type="number"
                      value={budgetVal}
                      onChange={e => setBudgetVal(e.target.value)}
                      placeholder="e.g. 50000000"
                      className="w-full h-10 px-3 bg-background border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold text-navy"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">
                      Budget Notes / Target Allocation
                    </label>
                    <textarea
                      value={budgetNotes}
                      onChange={e => setBudgetNotes(e.target.value)}
                      placeholder="Provide notes on earthing, mast installations, fiber node phases, etc..."
                      rows={3}
                      className="w-full p-3 bg-background border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProj(null)}
                      className="h-10 px-4 border border-border text-text hover:bg-background rounded-md text-xs transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingBudget}
                      className="h-10 px-5 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-md transition shadow-sm"
                    >
                      {submittingBudget ? 'Updating...' : 'Save Advisory Budget'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
