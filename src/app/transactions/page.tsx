"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Transaction } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { History, FileSpreadsheet, Search, RefreshCw } from 'lucide-react';

export default function TransactionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user && user.role === 'pm') {
      router.push('/dashboard');
      return;
    }

    const fetchLogs = async () => {
      try {
        const logs = await db.getTransactions();
        setTransactions(logs);
      } catch (err) {
        console.error('Error loading transaction logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [user, router]);

  const filteredLogs = transactions.filter(tx => 
    tx.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    (tx.asset_or_sku_code && tx.asset_or_sku_code.toLowerCase().includes(search.toLowerCase())) ||
    tx.performed_by_name?.toLowerCase().includes(search.toLowerCase()) ||
    (tx.counterparty_name && tx.counterparty_name.toLowerCase().includes(search.toLowerCase()))
  );

  const txColors: Record<string, string> = {
    checkout: 'text-warning font-semibold',
    return: 'text-success font-semibold',
    stock_added: 'text-primary font-semibold',
    stock_consumed: 'text-navy font-semibold',
    retired: 'text-text-muted font-semibold',
    sent_for_repair: 'text-danger font-semibold',
    returned_from_repair: 'text-success font-semibold'
  };

  const txLabels: Record<string, string> = {
    checkout: 'Checked Out',
    return: 'Returned',
    stock_added: 'Stock Added',
    stock_consumed: 'Stock Consumed',
    retired: 'Retired',
    sent_for_repair: 'Sent for Repair',
    returned_from_repair: 'Returned from Repair'
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
      <div>
        <h2 className="text-xl font-bold text-navy">Audit Transactions Log</h2>
        <p className="text-sm text-text-muted">Immutable history ledger of all inventory movements and physical custody transfers</p>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search items, operators, codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary"
            />
          </div>
          <span className="text-xs text-text-muted font-semibold">
            Showing {filteredLogs.length} of {transactions.length} total entries
          </span>
        </div>

        {/* Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Event Type</th>
                <th className="px-6 py-3">Item Details</th>
                <th className="px-6 py-3">Quantity</th>
                <th className="px-6 py-3">Performed By</th>
                <th className="px-6 py-3">Recipient / PM</th>
                <th className="px-6 py-3">Intake Cond.</th>
                <th className="px-6 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-text-muted italic">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(tx => (
                  <tr key={tx.id} className="hover:bg-background/40 transition-colors">
                    <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${txColors[tx.transaction_type] || ''}`}>
                      {txLabels[tx.transaction_type] || tx.transaction_type}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-text">{tx.item_name}</div>
                      {tx.asset_or_sku_code && (
                        <div className="text-[10px] text-text-muted font-mono">{tx.asset_or_sku_code}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text font-semibold">
                      {tx.quantity} unit{tx.quantity > 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 text-text-muted font-medium whitespace-nowrap">
                      {tx.performed_by_name}
                    </td>
                    <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                      {tx.counterparty_name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize text-navy font-semibold">
                      {tx.condition_at_event ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px]
                          ${tx.condition_at_event === 'good' ? 'bg-success-tint text-success' : 'bg-danger-tint text-danger'}
                        `}>
                          {tx.condition_at_event.replace('_', ' ')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-text-muted max-w-xs truncate" title={tx.notes || ''}>
                      {tx.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
