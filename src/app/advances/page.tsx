'use client';

import React, { useState, useEffect } from 'react';
import { db, CashAdvance, RetirementEntry, User, Project } from '@/lib/db';
import { Coins, DollarSign, Clock, CheckCircle, XCircle, Plus, FileText, ArrowLeft, AlertTriangle, Eye, Download, User as UserIcon, Calendar, Check, ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/PMDashboard';
import { useAuth } from '@/context/AuthContext';

export default function AdvancesPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [selectedAdvance, setSelectedAdvance] = useState<CashAdvance | null>(null);
  const [retirementEntries, setRetirementEntries] = useState<RetirementEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'advances' | 'ledger'>('advances');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal controls
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);

  // Request Form State
  const [requestForm, setRequestForm] = useState({
    projectId: '',
    projectName: '',
    purpose: '',
    amountRequested: '',
    expectedRetirementDate: ''
  });

  // Disbursement Form State
  const [disburseForm, setDisburseForm] = useState({
    method: 'bank_transfer' as 'bank_transfer' | 'cash',
    amount: '',
    bankReference: '',
    bankAccount: '',
    witnessName: '',
    signedProofUrl: ''
  });

  // Rejection State
  const [rejectionReason, setRejectionReason] = useState('');

  // Retirement Form State
  const [retirementForm, setRetirementForm] = useState({
    category: 'fuel' as 'fuel' | 'allowances' | 'materials' | 'accommodation' | 'other',
    description: '',
    amount: '',
    entryDate: new Date().toISOString().split('T')[0],
    receiptPhotoUrl: ''
  });

  useEffect(() => {
    // Check overdue on entry
    const triggerCheck = async () => {
      try {
        await db.checkOverdueAdvances();
      } catch (err) {
        console.warn('Overdue check failed:', err);
      }
    };
    triggerCheck();

    const fetchProjects = async () => {
      try {
        const projs = await db.getProjects();
        const activeProjs = projs.filter(p => p.status === 'active');
        setProjects(activeProjs);
        if (activeProjs.length > 0) {
          setRequestForm(prev => ({
            ...prev,
            projectId: activeProjs[0].id,
            projectName: activeProjs[0].name
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch projects:', err);
      }
    };
    fetchProjects();

    if (currentUser) {
      fetchAdvances(currentUser);
    }
  }, [currentUser]);

  const fetchAdvances = async (user: User) => {
    setIsLoading(true);
    try {
      const data = await db.getCashAdvances(user.role, user.id);
      setAdvances(data);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to fetch cash advances.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchRetirement = async (advId: string) => {
    try {
      const data = await db.getRetirementEntries(advId);
      setRetirementEntries(data);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const amount = Number(requestForm.amountRequested);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Please specify a positive requested amount.');
      return;
    }

    try {
      await db.requestCashAdvance({
        requested_by: currentUser.id,
        project_id: requestForm.projectId,
        purpose: requestForm.purpose,
        amount_requested_ugx: amount,
        expected_retirement_date: requestForm.expectedRetirementDate
      });
      setSuccessMsg('Advance request submitted successfully.');
      setShowRequestModal(false);
      setRequestForm({ projectId: projects[0]?.id || '', projectName: projects[0]?.name || '', purpose: '', amountRequested: '', expectedRetirementDate: '' });
      fetchAdvances(currentUser);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to submit request.');
    }
  };

  const handleApprove = async () => {
    if (!selectedAdvance || !currentUser) return;
    try {
      await db.approveCashAdvance(selectedAdvance.id, currentUser.id);
      setSuccessMsg('Advance request approved.');
      setShowApproveModal(false);
      setSelectedAdvance(null);
      fetchAdvances(currentUser);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to approve request.');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvance || !currentUser) return;
    if (!rejectionReason.trim()) {
      setErrorMsg('Please specify a rejection reason.');
      return;
    }
    try {
      await db.rejectCashAdvance(selectedAdvance.id, currentUser.id, rejectionReason);
      setSuccessMsg('Advance request rejected.');
      setShowApproveModal(false);
      setRejectionReason('');
      setSelectedAdvance(null);
      fetchAdvances(currentUser);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to reject request.');
    }
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvance || !currentUser) return;
    setErrorMsg(null);

    const amountVal = Number(disburseForm.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setErrorMsg('Please enter a valid disbursement amount.');
      return;
    }

    if (disburseForm.method === 'bank_transfer') {
      if (!disburseForm.bankReference || !disburseForm.bankAccount) {
        setErrorMsg('Bank reference and bank account are required.');
        return;
      }
    } else {
      if (!disburseForm.witnessName || !disburseForm.signedProofUrl) {
        setErrorMsg('Witness name and signed handover proof photo are required.');
        return;
      }
    }

    try {
      await db.disburseAdvance({
        advance_id: selectedAdvance.id,
        method: disburseForm.method,
        amount_ugx: amountVal,
        bank_reference: disburseForm.bankReference || undefined,
        bank_account: disburseForm.bankAccount || undefined,
        witness_name: disburseForm.witnessName || undefined,
        signed_proof_url: disburseForm.signedProofUrl || undefined,
        disbursed_by: currentUser.id
      });
      setSuccessMsg('Funds successfully marked as disbursed.');
      setShowDisburseModal(false);
      setSelectedAdvance(null);
      setDisburseForm({ method: 'bank_transfer', amount: '', bankReference: '', bankAccount: '', witnessName: '', signedProofUrl: '' });
      fetchAdvances(currentUser);
    } catch (e: any) {
      setErrorMsg(e.message || 'Disbursement failed.');
    }
  };

  const handleRetirementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvance || !currentUser) return;
    setErrorMsg(null);

    const amountVal = Number(retirementForm.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setErrorMsg('Please enter a valid expense amount.');
      return;
    }
    if (!retirementForm.description.trim()) {
      setErrorMsg('Please specify expense details.');
      return;
    }
    if (!retirementForm.receiptPhotoUrl) {
      setErrorMsg('A receipt photo upload is mandatory to save this entry.');
      return;
    }

    try {
      await db.submitRetirementEntry({
        advance_id: selectedAdvance.id,
        submitted_by: currentUser.id,
        category: retirementForm.category,
        description: retirementForm.description,
        amount_ugx: amountVal,
        receipt_photo_url: retirementForm.receiptPhotoUrl,
        entry_date: retirementForm.entryDate
      });

      setSuccessMsg('Retirement entry logged successfully.');
      setRetirementForm({ category: 'fuel', description: '', amount: '', entryDate: new Date().toISOString().split('T')[0], receiptPhotoUrl: '' });
      
      // Refresh advance details
      const updatedAdvances = await db.getCashAdvances(currentUser.role, currentUser.id);
      setAdvances(updatedAdvances);
      const updatedSelected = updatedAdvances.find(a => a.id === selectedAdvance.id);
      if (updatedSelected) setSelectedAdvance(updatedSelected);
      
      handleFetchRetirement(selectedAdvance.id);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to submit retirement.');
    }
  };

  // Helper file upload simulated trigger
  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'proof' | 'receipt') => {
    const file = e.target.files?.[0];
    if (file) {
      const mockUrl = URL.createObjectURL(file);
      if (type === 'proof') {
        setDisburseForm(prev => ({ ...prev, signedProofUrl: mockUrl }));
      } else {
        setRetirementForm(prev => ({ ...prev, receiptPhotoUrl: mockUrl }));
      }
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(val);
  };

  const getAgingDays = (expectedDateStr: string) => {
    const expected = new Date(expectedDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    expected.setHours(0,0,0,0);
    const diffTime = today.getTime() - expected.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getAgingBucket = (days: number) => {
    if (days <= 0) return 'Current';
    if (days <= 30) return '1 - 30 days';
    if (days <= 60) return '31 - 60 days';
    if (days <= 90) return '61 - 90 days';
    return '90+ days';
  };

  if (authLoading || (isLoading && advances.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-text bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-text-muted mt-4">Loading accountability console...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-text bg-background">
        <p className="text-sm text-text-muted">Please log in to view this page.</p>
      </div>
    );
  }

  // Aggregate Metrics for CFO View
  const cfoMetrics = {
    totalOutstanding: advances.reduce((sum, a) => sum + (a.outstanding_ugx || 0), 0),
    pendingApproval: advances.filter(a => a.status === 'pending').length,
    overdueCount: advances.filter(a => a.status === 'overdue').length,
    disbursedMonth: advances
      .filter(a => ['disbursed', 'partially_retired', 'retired', 'overdue'].includes(a.status))
      .reduce((sum, a) => sum + (a.amount_disbursed_ugx || 0), 0)
  };

  // Aggregate ledger rows per PM
  const pmLedgerMap = new Map<string, { name: string; totalAdvanced: number; outstanding: number; overdueCount: number }>();
  advances.forEach(a => {
    const pmId = a.requested_by;
    const pmName = a.requested_by_name || 'PM Operator';
    const outstanding = a.outstanding_ugx || 0;
    const advanced = a.amount_disbursed_ugx || 0;
    const isOverdue = a.status === 'overdue';

    if (!pmLedgerMap.has(pmId)) {
      pmLedgerMap.set(pmId, { name: pmName, totalAdvanced: 0, outstanding: 0, overdueCount: 0 });
    }
    const current = pmLedgerMap.get(pmId)!;
    current.totalAdvanced += advanced;
    current.outstanding += outstanding;
    if (isOverdue) current.overdueCount += 1;
  });
  const pmLedgerRows = Array.from(pmLedgerMap.values());

  // PM specific metrics
  const pmOverdueAdvances = advances.filter(a => a.status === 'overdue');
  const pmTotalOverdueAmount = pmOverdueAdvances.reduce((sum, a) => sum + (a.outstanding_ugx || 0), 0);
  const hasOverdueLock = pmOverdueAdvances.length > 0;

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col justify-between gap-4 pb-4 border-b border-border md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Cash Advances & Accountability
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Monitor petty cash distributions, outstanding balances, and aging project expenses.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface border border-border">
          <UserIcon className="w-4 h-4 text-primary" />
          <div>
            <p className="text-xs font-semibold text-text">{currentUser.full_name}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">{currentUser.role === 'cfo' ? 'CFO Executive' : 'Project Manager'}</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-3 p-3 text-xs font-medium text-success bg-success-tint border border-success/15 rounded-md">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-success hover:text-text">&times;</button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 p-3 text-xs font-medium text-danger bg-danger-tint border border-danger/15 rounded-md">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-danger hover:text-text">&times;</button>
        </div>
      )}

      {/* PM Lock Banner */}
      {currentUser.role === 'pm' && hasOverdueLock && (
        <div className="p-4 border rounded-lg bg-danger-tint border-danger/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-danger-tint rounded border border-danger/20 text-danger">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy">New Request Actions Blocked</h3>
              <p className="text-xs mt-0.5 text-text">
                You have {pmOverdueAdvances.length} overdue cash advance accountability report{pmOverdueAdvances.length > 1 ? 's' : ''} totalling <strong className="text-danger font-semibold">{formatCurrency(pmTotalOverdueAmount)}</strong>.
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Please submit receipts below to clear your outstanding status balance.</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-danger-tint border border-danger/20 rounded text-danger text-xs font-semibold shrink-0">
            Blocked Outstanding
          </div>
        </div>
      )}

      {/* CFO Metrics Cards */}
      {currentUser.role === 'cfo' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-surface border border-border rounded-lg hover:shadow-sm transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted">Outstanding Balance</span>
              <Coins className="w-5 h-5 text-warning" />
            </div>
            <p className="text-xl font-bold text-navy">{formatCurrency(cfoMetrics.totalOutstanding)}</p>
            <p className="text-[10px] text-text-muted mt-1">Active petty cash awaiting audit</p>
          </div>

          <div className="p-4 bg-surface border border-border rounded-lg hover:shadow-sm transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted">Pending CFO Review</span>
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold text-navy">{cfoMetrics.pendingApproval}</p>
            <p className="text-[10px] text-text-muted mt-1">Requests awaiting approval decision</p>
          </div>

          <div className="p-4 bg-surface border border-border rounded-lg hover:shadow-sm transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted">Overdue Advances</span>
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <p className="text-xl font-bold text-danger">{cfoMetrics.overdueCount}</p>
            <p className="text-[10px] text-text-muted mt-1">Accountabilities past expected date</p>
          </div>

          <div className="p-4 bg-surface border border-border rounded-lg hover:shadow-sm transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted">Disbursed Total</span>
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <p className="text-xl font-bold text-navy">{formatCurrency(cfoMetrics.disbursedMonth)}</p>
            <p className="text-[10px] text-text-muted mt-1">Aggregate payments disbursed</p>
          </div>
        </div>
      )}

      {/* CFO Tabs */}
      {currentUser.role === 'cfo' && (
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('advances')}
            className={`px-4 py-2 font-semibold text-xs transition-all border-b-2 ${
              activeTab === 'advances'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            All Advances Log
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 font-semibold text-xs transition-all border-b-2 ${
              activeTab === 'ledger'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            Per-PM Balance Sheet
          </button>
        </div>
      )}

      {/* PM Actions & CFO Advances Tab */}
      {(currentUser.role === 'pm' || activeTab === 'advances') && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-navy">Cash Advance Tracking Ledger</h2>
            {currentUser.role === 'pm' && (
              <button
                disabled={hasOverdueLock}
                onClick={() => setShowRequestModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold text-xs transition shadow-sm ${
                  hasOverdueLock
                    ? 'bg-neutral-tint text-text-muted border border-border cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/95 text-white'
                }`}
                title={hasOverdueLock ? 'Clear overdue reports to request new advances' : 'Request cash advance'}
              >
                <Plus className="w-3.5 h-3.5" />
                Request Advance
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-background border-b border-border">
                  {currentUser.role === 'cfo' && <th className="p-3">Requested By</th>}
                  <th className="p-3">Project</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3">Amount Requested</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Outstanding Bal</th>
                  <th className="p-3">Retirement Deadline</th>
                  {currentUser.role === 'cfo' && <th className="p-3">Aging</th>}
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {advances.length === 0 ? (
                  <tr>
                    <td colSpan={currentUser.role === 'cfo' ? 9 : 7} className="p-8 text-center text-text-muted">
                      No cash advances records found.
                    </td>
                  </tr>
                ) : (
                  advances.map((adv) => {
                    const agingDays = getAgingDays(adv.expected_retirement_date);
                    return (
                      <tr key={adv.id} className="hover:bg-background/25 transition-colors">
                        {currentUser.role === 'cfo' && (
                          <td className="p-3">
                            <span className="font-semibold text-text">{adv.requested_by_name}</span>
                          </td>
                        )}
                        <td className="p-3 font-semibold text-navy">{adv.project_name}</td>
                        <td className="p-3 text-text-muted max-w-xs truncate" title={adv.purpose}>
                          {adv.purpose}
                        </td>
                        <td className="p-3 text-text font-medium">{formatCurrency(adv.amount_requested_ugx)}</td>
                        <td className="p-3">
                          <StatusBadge status={adv.status} />
                        </td>
                        <td className="p-3 text-warning font-semibold">
                          {adv.status === 'pending' || adv.status === 'rejected' ? '—' : formatCurrency(adv.outstanding_ugx || 0)}
                        </td>
                        <td className="p-3 text-text-muted">
                          {new Date(adv.expected_retirement_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        {currentUser.role === 'cfo' && (
                          <td className="p-3">
                            {['disbursed', 'partially_retired', 'overdue'].includes(adv.status) && agingDays > 0 ? (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-danger-tint text-danger border border-danger/10">
                                {getAgingBucket(agingDays)}
                              </span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>
                        )}
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            {/* CFO Decision options */}
                            {currentUser.role === 'cfo' && adv.status === 'pending' && (
                              <button
                                onClick={() => { setSelectedAdvance(adv); setShowApproveModal(true); }}
                                className="px-2.5 py-1 bg-primary hover:bg-primary/95 text-white rounded text-[10px] font-bold transition"
                              >
                                Review Request
                              </button>
                            )}

                            {/* CFO Disbursement Option */}
                            {currentUser.role === 'cfo' && adv.status === 'approved' && (
                              <button
                                onClick={() => {
                                  setSelectedAdvance(adv);
                                  setDisburseForm(prev => ({ ...prev, amount: adv.amount_requested_ugx.toString() }));
                                  setShowDisburseModal(true);
                                }}
                                className="px-2.5 py-1 bg-warning hover:bg-warning/90 text-white rounded text-[10px] font-bold transition"
                              >
                                Disburse Funds
                              </button>
                            )}

                            {/* Details Viewer */}
                            <button
                              onClick={() => {
                                setSelectedAdvance(adv);
                                handleFetchRetirement(adv.id);
                                setShowDetailModal(true);
                              }}
                              className="p-1 hover:bg-background border border-border text-navy rounded transition"
                              title="View Details & Accountabilities"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CFO Per-PM Ledger Tab */}
      {currentUser.role === 'cfo' && activeTab === 'ledger' && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-bold text-navy">Aggregated Project Manager Balance Sheets</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-background border-b border-border">
                  <th className="p-3">Project Manager Name</th>
                  <th className="p-3">Total Ever Advanced</th>
                  <th className="p-3">Outstanding Balance</th>
                  <th className="p-3">Overdue Accountability Reports</th>
                  <th className="p-3">Accountability Risk Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {pmLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-text-muted">
                      No PM activities reported yet.
                    </td>
                  </tr>
                ) : (
                  pmLedgerRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-background/25 transition-colors">
                      <td className="p-3 font-bold text-text">{row.name}</td>
                      <td className="p-3 text-text">{formatCurrency(row.totalAdvanced)}</td>
                      <td className="p-3 text-warning font-semibold">{formatCurrency(row.outstanding)}</td>
                      <td className="p-3">
                        {row.overdueCount > 0 ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-danger-tint text-danger border border-danger/10">
                            {row.overdueCount} Overdue
                          </span>
                        ) : (
                          <span className="text-text-muted">None</span>
                        )}
                      </td>
                      <td className="p-3">
                        {row.overdueCount > 0 ? (
                          <span className="text-danger text-[10px] font-bold uppercase tracking-wider">Blocked (Locked Accounts)</span>
                        ) : row.outstanding > 0 ? (
                          <span className="text-warning text-[10px] font-bold uppercase tracking-wider">Active (Outstanding Clean)</span>
                        ) : (
                          <span className="text-success text-[10px] font-bold uppercase tracking-wider">Cleared</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* MODAL 1: PM New Request Wizard */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg overflow-hidden shadow-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy">Submit Petty Cash Request</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-text-muted hover:text-text text-lg">&times;</button>
            </div>
            <form onSubmit={handleRequestSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Project</label>
                <select
                  required
                  value={requestForm.projectId}
                  onChange={e => {
                    const selectedId = e.target.value;
                    const chosen = projects.find(p => p.id === selectedId);
                    setRequestForm(prev => ({
                      ...prev,
                      projectId: selectedId,
                      projectName: chosen ? chosen.name : ''
                    }));
                  }}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background text-text focus:outline-none focus:border-primary transition"
                >
                  <option value="" disabled>Select active project...</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Purpose Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe detail usage of cash (e.g. trenching allowances, local materials, fuel)"
                  value={requestForm.purpose}
                  onChange={e => setRequestForm(prev => ({ ...prev, purpose: e.target.value }))}
                  className="w-full p-3 border border-border rounded-md text-sm bg-background text-text focus:outline-none focus:border-primary transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Amount Requested (UGX)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500000"
                    value={requestForm.amountRequested}
                    onChange={e => setRequestForm(prev => ({ ...prev, amountRequested: e.target.value }))}
                    className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background text-text focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Retirement Deadline</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={requestForm.expectedRetirementDate}
                    onChange={e => setRequestForm(prev => ({ ...prev, expectedRetirementDate: e.target.value }))}
                    className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background text-text focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-3 h-9 text-xs font-semibold text-text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 h-9 text-xs font-bold bg-primary hover:bg-primary/95 text-white rounded shadow-sm transition"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL 2: CFO Review & Decision Wizard */}
      {showApproveModal && selectedAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg overflow-hidden shadow-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy">Review Cash Advance Request</h3>
              <button onClick={() => setShowApproveModal(false)} className="text-text-muted hover:text-text text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-background rounded-md border border-border space-y-2">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Request Metadata</p>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs pt-1.5">
                  <span className="text-text-muted">PM Requester:</span>
                  <span className="font-semibold text-text text-right">{selectedAdvance.requested_by_name}</span>
                  
                  <span className="text-text-muted">Project:</span>
                  <span className="font-semibold text-text text-right">{selectedAdvance.project_name}</span>

                  <span className="text-text-muted">Amount Requested:</span>
                  <span className="font-bold text-primary text-right">{formatCurrency(selectedAdvance.amount_requested_ugx)}</span>

                  <span className="text-text-muted">Target Deadline:</span>
                  <span className="text-text text-right">{selectedAdvance.expected_retirement_date}</span>
                </div>
                <div className="pt-2 border-t border-border text-xs">
                  <p className="text-text-muted mb-1">Purpose:</p>
                  <p className="text-text bg-surface p-2 rounded border border-border text-[11px] italic">{selectedAdvance.purpose}</p>
                </div>
              </div>

              {/* Outstanding Overdue warning on CFO approve screen */}
              {(() => {
                const pmOverdues = advances.filter(a => a.requested_by === selectedAdvance.requested_by && a.status === 'overdue');
                if (pmOverdues.length > 0) {
                  const overSum = pmOverdues.reduce((sum, a) => sum + (a.outstanding_ugx || 0), 0);
                  return (
                    <div className="flex gap-2.5 p-3 bg-danger-tint border border-danger/15 rounded-md text-xs text-danger">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-danger" />
                      <div>
                        <strong className="font-bold text-navy">Accountability Overdue Warning:</strong>
                        <p className="mt-0.5 text-[11px]">
                          This PM currently has {pmOverdues.length} overdue reports outstanding totalling {formatCurrency(overSum)}. Approving this request will act as a CFO override.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex flex-col sm:flex-row gap-3 border-t border-border pt-4">
                <div className="flex-1">
                  <form onSubmit={handleReject} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Specify rejection reason..."
                      required
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="flex-1 h-8 px-2.5 text-xs bg-background border border-border rounded text-text focus:outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      className="px-3 h-8 bg-danger hover:bg-danger/90 text-white rounded text-[11px] font-bold transition whitespace-nowrap"
                    >
                      Reject
                    </button>
                  </form>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    onClick={handleApprove}
                    className="px-4 h-8 bg-success hover:bg-success/90 text-white rounded text-[11px] font-bold transition shadow-sm"
                  >
                    Approve Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* MODAL 3: CFO Disbursement Handover Portal */}
      {showDisburseModal && selectedAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg overflow-hidden shadow-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy">Disburse Approved Advance</h3>
              <button onClick={() => setShowDisburseModal(false)} className="text-text-muted hover:text-text text-lg">&times;</button>
            </div>
            <form onSubmit={handleDisburseSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-background rounded-md border border-border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Target PM:</span>
                  <span className="text-text font-semibold">{selectedAdvance.requested_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Project:</span>
                  <span className="text-text font-semibold">{selectedAdvance.project_name}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="text-text-muted">Approved Allocation:</span>
                  <span className="text-primary font-bold">{formatCurrency(selectedAdvance.amount_requested_ugx)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1.5">Disbursement Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDisburseForm(prev => ({ ...prev, method: 'bank_transfer' }))}
                    className={`py-2 rounded border font-bold text-xs transition text-center ${
                      disburseForm.method === 'bank_transfer'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-text-muted hover:text-text'
                    }`}
                  >
                    Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisburseForm(prev => ({ ...prev, method: 'cash' }))}
                    className={`py-2 rounded border font-bold text-xs transition text-center ${
                      disburseForm.method === 'cash'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-text-muted hover:text-text'
                    }`}
                  >
                    Cash Handover
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Disbursed Amount (UGX)</label>
                <input
                  type="number"
                  required
                  placeholder="Enter payout amount"
                  value={disburseForm.amount}
                  onChange={e => setDisburseForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-border rounded-md text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>

              {/* Conditional Bank Fields */}
              {disburseForm.method === 'bank_transfer' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Bank Transfer Reference</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TXN1002931298"
                      value={disburseForm.bankReference}
                      onChange={e => setDisburseForm(prev => ({ ...prev, bankReference: e.target.value }))}
                      className="w-full h-10 px-3 bg-background border border-border rounded-md text-sm text-text focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Target Bank Account Info</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stanbic Bank A/C 9030018821"
                      value={disburseForm.bankAccount}
                      onChange={e => setDisburseForm(prev => ({ ...prev, bankAccount: e.target.value }))}
                      className="w-full h-10 px-3 bg-background border border-border rounded-md text-sm text-text focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Cash Fields */}
              {disburseForm.method === 'cash' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Witness Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Witness employee name"
                      value={disburseForm.witnessName}
                      onChange={e => setDisburseForm(prev => ({ ...prev, witnessName: e.target.value }))}
                      className="w-full h-10 px-3 bg-background border border-border rounded-md text-sm text-text focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1.5">Signed Proof Handover Photo (File Upload)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        required
                        onChange={e => handleSimulatedUpload(e, 'proof')}
                        className="hidden"
                        id="proof-upload-input"
                      />
                      <label
                        htmlFor="proof-upload-input"
                        className="px-3 h-8 bg-background border border-border hover:border-text-muted text-text hover:text-navy rounded text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 rotate-180" />
                        Choose Photo
                      </label>
                      <span className="text-[11px] text-text-muted truncate max-w-xs">
                        {disburseForm.signedProofUrl ? 'Image Selected ✓' : 'No proof file attached'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-3 h-9 text-xs font-semibold text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 h-9 text-xs font-bold bg-warning hover:bg-warning/90 text-white rounded transition shadow-sm"
                >
                  Confirm Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL 4: Detail View & PM Accountability Submission */}
      {showDetailModal && selectedAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-lg overflow-hidden shadow-lg flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-navy">Advance Accountability Detail</h3>
                <p className="text-[11px] text-text-muted mt-0.5">Project: {selectedAdvance.project_name}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-text-muted hover:text-text text-lg">&times;</button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              
              {/* Advance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-background border border-border rounded-md text-xs">
                <div className="space-y-1.5">
                  <h4 className="font-bold text-navy border-b border-border pb-1 uppercase tracking-wider text-[10px]">Overview Details</h4>
                  <div className="grid grid-cols-2 gap-y-1">
                    <span className="text-text-muted">Requester:</span>
                    <span className="text-text text-right">{selectedAdvance.requested_by_name}</span>
                    <span className="text-text-muted">Total Requested:</span>
                    <span className="text-text text-right font-medium">{formatCurrency(selectedAdvance.amount_requested_ugx)}</span>
                    <span className="text-text-muted">Status:</span>
                    <div className="text-right"><StatusBadge status={selectedAdvance.status} /></div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-navy border-b border-border pb-1 uppercase tracking-wider text-[10px]">Financial Balances</h4>
                  <div className="grid grid-cols-2 gap-y-1">
                    <span className="text-text-muted">Disbursed Amt:</span>
                    <span className="text-text text-right font-medium">{formatCurrency(selectedAdvance.amount_disbursed_ugx || 0)}</span>
                    <span className="text-text-muted">Accounted/Retired:</span>
                    <span className="text-success text-right font-semibold">{formatCurrency(selectedAdvance.amount_retired_ugx || 0)}</span>
                    <span className="text-text-muted">Outstanding Bal:</span>
                    <span className="text-warning text-right font-bold">{formatCurrency(selectedAdvance.outstanding_ugx || 0)}</span>
                  </div>
                </div>

                {selectedAdvance.status === 'rejected' && selectedAdvance.rejection_reason && (
                  <div className="col-span-2 p-2.5 bg-danger-tint border border-danger/10 rounded text-[11px] text-danger">
                    <strong>Rejection Comment:</strong> {selectedAdvance.rejection_reason}
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {['disbursed', 'partially_retired', 'retired', 'overdue'].includes(selectedAdvance.status) && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>Accounted Spend Ratio</span>
                    <span className="font-semibold text-text">
                      {Math.round(((selectedAdvance.amount_retired_ugx || 0) / (selectedAdvance.amount_disbursed_ugx || 1)) * 100)}% Accounted
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2.5 border border-border overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((selectedAdvance.amount_retired_ugx || 0) / (selectedAdvance.amount_disbursed_ugx || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-navy">Itemized Expenses Log</h4>
                <div className="bg-background border border-border rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-background border-b border-border">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs">
                      {retirementEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-text-muted text-[11px]">
                            No retirement expenses logged for this advance yet.
                          </td>
                        </tr>
                      ) : (
                        retirementEntries.map((ret) => (
                          <tr key={ret.id} className="hover:bg-surface/50">
                            <td className="p-2.5 text-[10px] text-text-muted">{ret.entry_date}</td>
                            <td className="p-2.5 font-semibold text-primary capitalize">{ret.category}</td>
                            <td className="p-2.5 text-text">{ret.description}</td>
                            <td className="p-2.5 text-right font-medium text-text">{formatCurrency(ret.amount_ugx)}</td>
                            <td className="p-2.5 text-right">
                              <a
                                href={ret.receipt_photo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface hover:bg-background border border-border text-text hover:text-navy rounded text-[10px] transition"
                              >
                                View File
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PM Expense Append Form */}
              {currentUser.role === 'pm' && ['disbursed', 'partially_retired', 'overdue'].includes(selectedAdvance.status) && (
                <div className="p-4 border border-border rounded-md bg-background/50 space-y-4">
                  <h4 className="text-xs font-bold text-navy flex items-center gap-1.5">
                    <Plus className="w-4.5 h-4.5 text-primary" />
                    Log Expense Retirement Entry
                  </h4>
                  <form onSubmit={handleRetirementSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Spend Category</label>
                        <select
                          value={retirementForm.category}
                          onChange={e => setRetirementForm(prev => ({ ...prev, category: e.target.value as any }))}
                          className="w-full h-10 px-3 bg-background border border-border rounded-md text-xs focus:outline-none"
                        >
                          <option value="fuel">Fuel & Transport</option>
                          <option value="allowances">Staff Allowances</option>
                          <option value="materials">Local Materials</option>
                          <option value="accommodation">Accommodation</option>
                          <option value="other">Other Expenses</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Cost (UGX)</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 150000"
                          value={retirementForm.amount}
                          onChange={e => setRetirementForm(prev => ({ ...prev, amount: e.target.value }))}
                          className="w-full h-10 px-3 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Expense Date</label>
                        <input
                          type="date"
                          required
                          value={retirementForm.entryDate}
                          onChange={e => setRetirementForm(prev => ({ ...prev, entryDate: e.target.value }))}
                          className="w-full h-10 px-3 bg-background border border-border rounded-md text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1">Itemized Description</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bought 40 liters diesel for generator transport truck"
                        value={retirementForm.description}
                        onChange={e => setRetirementForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full h-10 px-3 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text uppercase tracking-wider mb-1.5">Mandatory Receipt Photo Upload</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onChange={e => handleSimulatedUpload(e, 'receipt')}
                          className="hidden"
                          id="receipt-upload-input"
                        />
                        <label
                          htmlFor="receipt-upload-input"
                          className="px-3 h-8 bg-background border border-border hover:border-text-muted text-text hover:text-navy rounded text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 rotate-180" />
                          Choose Receipt
                        </label>
                        <span className="text-[11px] text-text-muted truncate max-w-xs">
                          {retirementForm.receiptPhotoUrl ? 'Receipt Selected ✓' : 'No photo uploaded'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border">
                      <button
                        type="submit"
                        className="px-4 h-9 bg-primary hover:bg-primary/95 text-white rounded text-xs font-bold shadow-sm transition"
                      >
                        Submit Accounted Entry
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border text-right bg-background shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 h-9 bg-surface hover:bg-background border border-border text-text text-xs font-semibold rounded transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
