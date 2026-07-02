'use client';

import React, { useState, useEffect } from 'react';
import { db, CashAdvance, RetirementEntry, User } from '@/lib/db';
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

  // Request Form State
  const [requestForm, setRequestForm] = useState({
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
        project_name: requestForm.projectName,
        purpose: requestForm.purpose,
        amount_requested_ugx: amount,
        expected_retirement_date: requestForm.expectedRetirementDate
      });
      setSuccessMsg('Advance request submitted successfully.');
      setShowRequestModal(false);
      setRequestForm({ projectName: '', purpose: '', amountRequested: '', expectedRetirementDate: '' });
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
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-100 bg-slate-950">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-md text-slate-400 mt-4">Loading accountability console...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-100 bg-slate-950">
        <p className="text-md text-slate-400">Please log in to view this page.</p>
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
    <div className="min-h-screen px-6 py-8 text-slate-100 bg-slate-950 font-sans">
      
      {/* Title Header */}
      <div className="flex flex-col justify-between gap-4 pb-6 mb-8 border-b md:flex-row md:items-center border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-200">
            Cash Advances & Accountability
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor petty cash distributions, outstanding balances, and aging project expenses.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800">
          <UserIcon className="w-5 h-5 text-indigo-400" />
          <div>
            <p className="text-sm font-semibold text-white">{currentUser.full_name}</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{currentUser.role === 'cfo' ? 'CFO Executive' : 'Project Manager'}</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 mb-6 text-sm font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-800/50 rounded-lg">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-white">&times;</button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 mb-6 text-sm font-medium text-rose-400 bg-rose-950/30 border border-rose-800/50 rounded-lg">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-rose-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* PM Lock Banner */}
      {currentUser.role === 'pm' && hasOverdueLock && (
        <div className="p-5 mb-8 border rounded-xl bg-rose-950/30 border-rose-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-900/40 rounded-lg border border-rose-700/50 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">New Request Actions Blocked</h3>
              <p className="text-sm mt-1 text-slate-300">
                You have {pmOverdueAdvances.length} overdue cash advance accountability report{pmOverdueAdvances.length > 1 ? 's' : ''} totalling <strong className="text-rose-300 font-semibold">{formatCurrency(pmTotalOverdueAmount)}</strong>.
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Please submit receipts below to clear your outstanding status balance.</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-rose-900/30 border border-rose-800 rounded-lg text-rose-300 text-sm font-semibold shrink-0">
            Blocked Outstanding
          </div>
        </div>
      )}

      {/* CFO Metrics Cards */}
      {currentUser.role === 'cfo' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-400">Outstanding Balance</span>
              <Coins className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-white">{formatCurrency(cfoMetrics.totalOutstanding)}</p>
            <p className="text-xs text-slate-500 mt-2">Active petty cash awaiting audit proof</p>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-400">Pending CFO Review</span>
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-white">{cfoMetrics.pendingApproval}</p>
            <p className="text-xs text-slate-500 mt-2">Requests awaiting approval decision</p>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-400">Overdue Advances</span>
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <p className="text-2xl font-black text-rose-400">{cfoMetrics.overdueCount}</p>
            <p className="text-xs text-slate-500 mt-2">Accountabilities past expected date</p>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-400">Disbursed Total</span>
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white">{formatCurrency(cfoMetrics.disbursedMonth)}</p>
            <p className="text-xs text-slate-500 mt-2">Aggregate payments disbursed</p>
          </div>
        </div>
      )}

      {/* CFO Tabs */}
      {currentUser.role === 'cfo' && (
        <div className="flex border-b border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab('advances')}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
              activeTab === 'advances'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            All Advances Log
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
              activeTab === 'ledger'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Per-PM Balance Sheet
          </button>
        </div>
      )}

      {/* PM Actions & CFO Advances Tab */}
      {(!isLoading && (currentUser.role === 'pm' || activeTab === 'advances')) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white">Cash Advance Tracking Ledger</h2>
            {currentUser.role === 'pm' && (
              <button
                disabled={hasOverdueLock}
                onClick={() => setShowRequestModal(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition shadow ${
                  hasOverdueLock
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98]'
                }`}
                title={hasOverdueLock ? 'Clear overdue reports to request new advances' : 'Request cash advance'}
              >
                <Plus className="w-4 h-4" />
                Request Advance
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50 border-b border-slate-800">
                  {currentUser.role === 'cfo' && <th className="p-4">Requested By</th>}
                  <th className="p-4">Project</th>
                  <th className="p-4">Purpose</th>
                  <th className="p-4">Amount Requested</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Outstanding Bal</th>
                  <th className="p-4">Retirement Deadline</th>
                  {currentUser.role === 'cfo' && <th className="p-4">Aging</th>}
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {advances.length === 0 ? (
                  <tr>
                    <td colSpan={currentUser.role === 'cfo' ? 9 : 7} className="p-8 text-center text-slate-500">
                      No cash advances records found.
                    </td>
                  </tr>
                ) : (
                  advances.map((adv) => {
                    const agingDays = getAgingDays(adv.expected_retirement_date);
                    return (
                      <tr key={adv.id} className="hover:bg-slate-900/30 transition">
                        {currentUser.role === 'cfo' && (
                          <td className="p-4">
                            <span className="font-semibold text-slate-200">{adv.requested_by_name}</span>
                          </td>
                        )}
                        <td className="p-4 font-semibold text-slate-100">{adv.project_name}</td>
                        <td className="p-4 text-sm text-slate-400 max-w-xs truncate" title={adv.purpose}>
                          {adv.purpose}
                        </td>
                        <td className="p-4 text-slate-200 font-medium">{formatCurrency(adv.amount_requested_ugx)}</td>
                        <td className="p-4">
                          <StatusBadge status={adv.status} />
                        </td>
                        <td className="p-4 text-amber-400/90 font-semibold">
                          {adv.status === 'pending' || adv.status === 'rejected' ? '—' : formatCurrency(adv.outstanding_ugx || 0)}
                        </td>
                        <td className="p-4 text-sm text-slate-300">
                          {new Date(adv.expected_retirement_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        {currentUser.role === 'cfo' && (
                          <td className="p-4">
                            {['disbursed', 'partially_retired', 'overdue'].includes(adv.status) && agingDays > 0 ? (
                              <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-950 text-rose-400 border border-rose-900">
                                {getAgingBucket(agingDays)}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">—</span>
                            )}
                          </td>
                        )}
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* CFO Decision options */}
                            {currentUser.role === 'cfo' && adv.status === 'pending' && (
                              <button
                                onClick={() => { setSelectedAdvance(adv); setShowApproveModal(true); }}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition"
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
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition"
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
                              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
                              title="View Details & Accountabilities"
                            >
                              <Eye className="w-4.5 h-4.5" />
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white">Aggregated Project Manager Balance Sheets</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50 border-b border-slate-800">
                  <th className="p-4">Project Manager Name</th>
                  <th className="p-4">Total Ever Advanced</th>
                  <th className="p-4">Outstanding Balance</th>
                  <th className="p-4">Overdue Accountability Reports</th>
                  <th className="p-4">Accountability Risk Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pmLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No PM activities reported yet.
                    </td>
                  </tr>
                ) : (
                  pmLedgerRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/30 transition">
                      <td className="p-4 font-bold text-white">{row.name}</td>
                      <td className="p-4 text-slate-200">{formatCurrency(row.totalAdvanced)}</td>
                      <td className="p-4 text-amber-400 font-semibold">{formatCurrency(row.outstanding)}</td>
                      <td className="p-4">
                        {row.overdueCount > 0 ? (
                          <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-950 text-rose-400 border border-rose-900">
                            {row.overdueCount} Overdue
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">None</span>
                        )}
                      </td>
                      <td className="p-4">
                        {row.overdueCount > 0 ? (
                          <span className="text-rose-400 text-xs font-bold uppercase tracking-wider">Blocked (Locked Accounts)</span>
                        ) : row.outstanding > 0 ? (
                          <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Active (Outstanding Clean)</span>
                        ) : (
                          <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Cleared</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Submit Petty Cash Request</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kampala Fiber Node Expansion"
                  value={requestForm.projectName}
                  onChange={e => setRequestForm(prev => ({ ...prev, projectName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Purpose Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe detail usage of cash (e.g. trenching contractor allowances, local materials, fuel)"
                  value={requestForm.purpose}
                  onChange={e => setRequestForm(prev => ({ ...prev, purpose: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Amount Requested (UGX)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500000"
                    value={requestForm.amountRequested}
                    onChange={e => setRequestForm(prev => ({ ...prev, amountRequested: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Retirement Deadline</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={requestForm.expectedRetirementDate}
                    onChange={e => setRequestForm(prev => ({ ...prev, expectedRetirementDate: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Review Cash Advance Request</h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Request Metadata</p>
                <div className="grid grid-cols-2 gap-y-2 text-sm pt-2">
                  <span className="text-slate-400">PM Requester:</span>
                  <span className="font-semibold text-white text-right">{selectedAdvance.requested_by_name}</span>
                  
                  <span className="text-slate-400">Project:</span>
                  <span className="font-semibold text-white text-right">{selectedAdvance.project_name}</span>

                  <span className="text-slate-400">Amount Requested:</span>
                  <span className="font-bold text-indigo-400 text-right">{formatCurrency(selectedAdvance.amount_requested_ugx)}</span>

                  <span className="text-slate-400">Target Deadline:</span>
                  <span className="text-slate-200 text-right">{selectedAdvance.expected_retirement_date}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 text-sm">
                  <p className="text-slate-400 mb-1">Purpose:</p>
                  <p className="text-slate-200 bg-slate-900 p-2.5 rounded border border-slate-800/80 text-xs italic">{selectedAdvance.purpose}</p>
                </div>
              </div>

              {/* Outstanding Overdue warning on CFO approve screen */}
              {(() => {
                const pmOverdues = advances.filter(a => a.requested_by === selectedAdvance.requested_by && a.status === 'overdue');
                if (pmOverdues.length > 0) {
                  const overSum = pmOverdues.reduce((sum, a) => sum + (a.outstanding_ugx || 0), 0);
                  return (
                    <div className="flex gap-3 p-4 bg-rose-950/20 border border-rose-800/50 rounded-lg text-xs text-rose-300">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                      <div>
                        <strong className="font-bold text-white">Accountability Overdue Warning:</strong>
                        <p className="mt-1">
                          This PM currently has {pmOverdues.length} overdue reports outstanding totalling {formatCurrency(overSum)}. Approving this request will act as a CFO override.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex gap-4 border-t border-slate-800 pt-4">
                <div className="flex-1">
                  <form onSubmit={handleReject} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Specify rejection reason..."
                      required
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded text-xs font-bold transition whitespace-nowrap"
                    >
                      Reject Request
                    </button>
                  </form>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    onClick={handleApprove}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition hover:scale-105"
                  >
                    Approve Advance
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* MODAL 3: CFO Disbursement Handover Portal */}
      {showDisburseModal && selectedAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Disburse Approved Advance</h3>
              <button onClick={() => setShowDisburseModal(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            <form onSubmit={handleDisburseSubmit} className="p-6 space-y-4">
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target PM:</span>
                  <span className="text-white font-semibold">{selectedAdvance.requested_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Project:</span>
                  <span className="text-white font-semibold">{selectedAdvance.project_name}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Approved Allocation:</span>
                  <span className="text-indigo-400 font-bold">{formatCurrency(selectedAdvance.amount_requested_ugx)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Disbursement Method</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setDisburseForm(prev => ({ ...prev, method: 'bank_transfer' }))}
                    className={`py-3 rounded-lg border font-bold text-sm transition text-center ${
                      disburseForm.method === 'bank_transfer'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisburseForm(prev => ({ ...prev, method: 'cash' }))}
                    className={`py-3 rounded-lg border font-bold text-sm transition text-center ${
                      disburseForm.method === 'cash'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Cash Handover
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Disbursed Amount (UGX)</label>
                <input
                  type="number"
                  required
                  placeholder="Enter payout amount"
                  value={disburseForm.amount}
                  onChange={e => setDisburseForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Conditional Bank Fields */}
              {disburseForm.method === 'bank_transfer' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bank Transfer Reference</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TXN1002931298"
                      value={disburseForm.bankReference}
                      onChange={e => setDisburseForm(prev => ({ ...prev, bankReference: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Bank Account Info</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stanbic Bank A/C 9030018821"
                      value={disburseForm.bankAccount}
                      onChange={e => setDisburseForm(prev => ({ ...prev, bankAccount: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Cash Fields */}
              {disburseForm.method === 'cash' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Witness Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Witness employee name"
                      value={disburseForm.witnessName}
                      onChange={e => setDisburseForm(prev => ({ ...prev, witnessName: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Signed Proof Handover Photo (File Upload)</label>
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
                        className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-2"
                      >
                        <Download className="w-4 h-4 rotate-180" />
                        Choose Photo
                      </label>
                      <span className="text-xs text-slate-400 truncate max-w-xs">
                        {disburseForm.signedProofUrl ? 'Image Selected ✓' : 'No proof file attached'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">Advance Accountability Detail</h3>
                <p className="text-xs text-slate-400 mt-0.5">Project: {selectedAdvance.project_name}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Advance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-950 border border-slate-800 rounded-xl text-sm">
                <div className="space-y-2">
                  <h4 className="font-bold text-white border-b border-slate-800 pb-1 uppercase tracking-wider text-xs">Overview Details</h4>
                  <div className="grid grid-cols-2 gap-y-1">
                    <span className="text-slate-400">Requester:</span>
                    <span className="text-slate-200 text-right">{selectedAdvance.requested_by_name}</span>
                    <span className="text-slate-400">Total Requested:</span>
                    <span className="text-slate-200 text-right font-medium">{formatCurrency(selectedAdvance.amount_requested_ugx)}</span>
                    <span className="text-slate-400">Status:</span>
                    <div className="text-right"><StatusBadge status={selectedAdvance.status} /></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-white border-b border-slate-800 pb-1 uppercase tracking-wider text-xs">Financial Balances</h4>
                  <div className="grid grid-cols-2 gap-y-1">
                    <span className="text-slate-400">Disbursed Amt:</span>
                    <span className="text-slate-200 text-right font-medium">{formatCurrency(selectedAdvance.amount_disbursed_ugx || 0)}</span>
                    <span className="text-slate-400">Accounted/Retired:</span>
                    <span className="text-emerald-400 text-right font-semibold">{formatCurrency(selectedAdvance.amount_retired_ugx || 0)}</span>
                    <span className="text-slate-400">Outstanding Bal:</span>
                    <span className="text-amber-400 text-right font-extrabold">{formatCurrency(selectedAdvance.outstanding_ugx || 0)}</span>
                  </div>
                </div>

                {selectedAdvance.status === 'rejected' && selectedAdvance.rejection_reason && (
                  <div className="col-span-2 p-3 bg-rose-950/20 border border-rose-900 rounded text-xs text-rose-300">
                    <strong>Rejection Comment:</strong> {selectedAdvance.rejection_reason}
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {['disbursed', 'partially_retired', 'retired', 'overdue'].includes(selectedAdvance.status) && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Accounted Spend Ratio</span>
                    <span className="font-semibold text-white">
                      {Math.round(((selectedAdvance.amount_retired_ugx || 0) / (selectedAdvance.amount_disbursed_ugx || 1)) * 100)}% Accounted
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((selectedAdvance.amount_retired_ugx || 0) / (selectedAdvance.amount_disbursed_ugx || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-md font-bold text-white">Itemized Expenses Log</h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/60 border-b border-slate-850">
                        <th className="p-3">Date</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-sm">
                      {retirementEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500 text-xs">
                            No retirement expenses logged for this advance yet.
                          </td>
                        </tr>
                      ) : (
                        retirementEntries.map((ret) => (
                          <tr key={ret.id} className="hover:bg-slate-900/10">
                            <td className="p-3 text-xs text-slate-400">{ret.entry_date}</td>
                            <td className="p-3 font-semibold text-indigo-400 capitalize">{ret.category}</td>
                            <td className="p-3 text-slate-300">{ret.description}</td>
                            <td className="p-3 text-right font-medium text-slate-200">{formatCurrency(ret.amount_ugx)}</td>
                            <td className="p-3 text-right">
                              <a
                                href={ret.receipt_photo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded text-xs transition"
                              >
                                View File
                                <ExternalLink className="w-3.5 h-3.5" />
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
                <div className="p-5 border border-slate-800/80 rounded-xl bg-slate-900/40 space-y-4">
                  <h4 className="text-md font-bold text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-400" />
                    Log Expense Retirement Entry
                  </h4>
                  <form onSubmit={handleRetirementSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Spend Category</label>
                        <select
                          value={retirementForm.category}
                          onChange={e => setRetirementForm(prev => ({ ...prev, category: e.target.value as any }))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none"
                        >
                          <option value="fuel">Fuel & Transport</option>
                          <option value="allowances">Staff Allowances</option>
                          <option value="materials">Local Materials</option>
                          <option value="accommodation">Accommodation</option>
                          <option value="other">Other Expenses</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cost (UGX)</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 150000"
                          value={retirementForm.amount}
                          onChange={e => setRetirementForm(prev => ({ ...prev, amount: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Expense Date</label>
                        <input
                          type="date"
                          required
                          value={retirementForm.entryDate}
                          onChange={e => setRetirementForm(prev => ({ ...prev, entryDate: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Itemized Description</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bought 40 liters diesel for generator transport truck"
                        value={retirementForm.description}
                        onChange={e => setRetirementForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mandatory Receipt Photo Upload</label>
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
                          className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-2"
                        >
                          <Download className="w-4 h-4 rotate-180" />
                          Choose Receipt
                        </label>
                        <span className="text-xs text-slate-400 truncate max-w-xs">
                          {retirementForm.receiptPhotoUrl ? 'Receipt Selected ✓' : 'No photo uploaded'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow transition"
                      >
                        Submit Accounted Entry
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-slate-800 text-right bg-slate-900 shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-sm font-semibold rounded-lg transition"
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
