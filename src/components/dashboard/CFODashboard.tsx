"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Request, Equipment, ConsumableStock, Category, CashAdvance } from '@/lib/db';
import { StatusBadge } from './PMDashboard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  PiggyBank, 
  ShoppingBag, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  User,
  Activity,
  Coins,
  DollarSign,
  PieChart as PieIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

export default function CFODashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [consumables, setConsumables] = useState<ConsumableStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const allReqs = await db.getRequests();
        const allEq = await db.getEquipment();
        const allCons = await db.getConsumables();
        const allCats = await db.getCategories();
        const allTxs = await db.getTransactions();
        let allAdvances: CashAdvance[] = [];
        try {
          allAdvances = await db.getCashAdvances('cfo', user.id);
        } catch (e) {
          console.warn('Failed to load advances in CFO dashboard:', e);
        }
        
        setRequests(allReqs);
        setEquipment(allEq);
        setConsumables(allCons);
        setCategories(allCats);
        setTransactions(allTxs);
        setAdvances(allAdvances);
      } catch (err) {
        console.error('Error fetching CFO dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // CFO Card Counts
  // Card 1: Total value of all equipment (reusable + consumables)
  const totalReusableValue = equipment.reduce((sum, item) => sum + parseFloat(item.unit_value_ugx.toString()), 0);
  const totalConsumableValue = consumables.reduce((sum, item) => sum + (parseFloat(item.unit_value_ugx.toString()) * parseFloat(item.quantity_on_hand.toString())), 0);
  const totalValueUgx = totalReusableValue + totalConsumableValue;

  // Card 2: Items Checked Out
  const checkedOutCount = equipment.filter(e => e.status === 'checked_out' || e.status === 'overdue').length;

  // Card 3: Pending CFO approval (Equipment)
  const pendingCfoApprovals = requests.filter(r => r.status === 'pending' && r.routed_to === 'cfo');

  // Card 4: Low stock alerts
  const lowStockCount = consumables.filter(c => c.quantity_on_hand <= c.reorder_level).length;

  // Petty Cash Metrics
  const cashMetrics = {
    totalOutstanding: advances.reduce((sum, a) => sum + (a.outstanding_ugx || 0), 0),
    pendingApproval: advances.filter(a => a.status === 'pending').length,
    overdueCount: advances.filter(a => a.status === 'overdue').length,
    disbursedMonth: advances
      .filter(a => ['disbursed', 'partially_retired', 'retired', 'overdue'].includes(a.status))
      .reduce((sum, a) => sum + (a.amount_disbursed_ugx || 0), 0)
  };

  const pendingCashRequests = advances.filter(a => a.status === 'pending');

  // Calculate Value by Category
  const categoryValues = categories.map(cat => {
    let value = 0;
    if (cat.item_type === 'reusable') {
      value = equipment
        .filter(e => e.category_id === cat.id)
        .reduce((sum, item) => sum + parseFloat(item.unit_value_ugx.toString()), 0);
    } else {
      value = consumables
        .filter(c => c.category_id === cat.id)
        .reduce((sum, item) => sum + (parseFloat(item.unit_value_ugx.toString()) * parseFloat(item.quantity_on_hand.toString())), 0);
    }
    return {
      name: cat.name,
      value: value,
      type: cat.item_type
    };
  }).sort((a, b) => b.value - a.value);

  const maxVal = Math.max(...categoryValues.map(cv => cv.value), 1);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(val);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-navy">CFO Executive Console</h2>
        <p className="text-sm text-text-muted">High-level financial oversight: petty cash advances and capital inventory metrics</p>
      </div>

      {/* Petty Cash Accountability Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-navy uppercase tracking-wider">Petty Cash & Advances Operations</h3>
          <Link href="/advances" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
            Open cash console <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cash Card 1 */}
          <div 
            onClick={() => router.push('/advances')}
            className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-warning/40 hover:bg-warning-tint/5 transition-all"
          >
            <div className="p-3 bg-warning-tint text-warning rounded-lg">
              <Coins size={22} />
            </div>
            <div>
              <div className="text-lg font-bold text-navy">{formatCurrency(cashMetrics.totalOutstanding)}</div>
              <div className="text-xs text-text-muted font-medium">Outstanding Petty Cash</div>
            </div>
          </div>

          {/* Cash Card 2 */}
          <div 
            onClick={() => router.push('/advances')}
            className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <Clock size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">{cashMetrics.pendingApproval}</div>
              <div className="text-xs text-text-muted font-medium">Pending Cash Requests</div>
            </div>
          </div>

          {/* Cash Card 3 */}
          <div 
            onClick={() => router.push('/advances')}
            className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-danger/40 hover:bg-danger-tint/5 transition-all"
          >
            <div className="p-3 bg-danger-tint text-danger rounded-lg">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-danger">{cashMetrics.overdueCount}</div>
              <div className="text-xs text-text-muted font-medium">Overdue Accountabilities</div>
            </div>
          </div>

          {/* Cash Card 4 */}
          <div 
            onClick={() => router.push('/advances')}
            className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-success/40 hover:bg-success-tint/5 transition-all"
          >
            <div className="p-3 bg-success-tint text-success rounded-lg">
              <DollarSign size={22} />
            </div>
            <div>
              <div className="text-lg font-bold text-navy">{formatCurrency(cashMetrics.disbursedMonth)}</div>
              <div className="text-xs text-text-muted font-medium">Total Payouts Handed Over</div>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment & Inventory Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-navy uppercase tracking-wider">Capital Assets & Inventory</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div 
            onClick={() => router.push('/equipment')}
            className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <PiggyBank size={22} />
            </div>
            <div>
              <div className="text-lg font-bold text-navy">{formatCurrency(totalValueUgx)}</div>
              <div className="text-xs text-text-muted font-medium">Total Equipment Valuation</div>
            </div>
          </div>

          {/* Card 2 */}
          <div 
            onClick={() => router.push('/equipment?status=checked_out')}
            className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-navy/40 hover:bg-navy/5 transition-all"
          >
            <div className="p-3 bg-navy/10 text-navy rounded-lg">
              <ShoppingBag size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">{checkedOutCount}</div>
              <div className="text-xs text-text-muted font-medium">Active Field Checkouts</div>
            </div>
          </div>

          {/* Card 3 */}
          <div 
            onClick={() => document.getElementById('cfo-approvals-table')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-warning/40 hover:bg-warning-tint/5 transition-all"
          >
            <div className="p-3 bg-warning-tint text-warning rounded-lg">
              <Clock size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">{pendingCfoApprovals.length}</div>
              <div className="text-xs text-text-muted font-medium">Pending Tools Approval</div>
            </div>
          </div>

          {/* Card 4 */}
          <div 
            onClick={() => router.push('/equipment?status=low_stock')}
            className="bg-surface border border-border p-4 rounded-lg flex items-center space-x-4 shadow-sm cursor-pointer hover:border-danger/40 hover:bg-danger-tint/5 transition-all"
          >
            <div className="p-3 bg-danger-tint text-danger rounded-lg">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">{lowStockCount}</div>
              <div className="text-xs text-text-muted font-medium">Low Stock SKUs</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Value Chart Column */}
        <div className="lg:col-span-1 bg-surface border border-border rounded-lg p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-navy">Asset Value by Category</h3>
            <p className="text-xs text-text-muted">Total capital holding per equipment type</p>
          </div>

          <div className="space-y-4 pt-2">
            {categoryValues.map(cv => {
              const pct = (cv.value / maxVal) * 100;
              return (
                <div key={cv.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-text">
                    <span>{cv.name}</span>
                    <span className="text-navy font-bold">{formatCurrency(cv.value)}</span>
                  </div>
                  <div className="w-full bg-background h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-text-muted capitalize">Type: {cv.type}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Table of pending approvals Column */}
        <div id="cfo-approvals-table" className="lg:col-span-2 bg-surface border border-border rounded-lg shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-border">
              <h3 className="text-sm font-bold text-navy">Pending High-Value Requests</h3>
              <p className="text-xs text-text-muted">Equipment and material requisitions awaiting CFO review</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                    <th className="px-5 py-3">Project & PM</th>
                    <th className="px-5 py-3">Site Location</th>
                    <th className="px-5 py-3">Requested Items</th>
                    <th className="px-5 py-3">Needed From</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingCfoApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-xs text-text-muted italic">
                        No requisitions currently routed for CFO approval.
                      </td>
                    </tr>
                  ) : (
                    pendingCfoApprovals.map(req => {
                      const itemsSummary = req.items?.map(it => `${it.name} (x${it.quantity_requested})`).join(', ') || 'No items';
                      return (
                        <tr key={req.id} className="hover:bg-background/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-navy">{req.project_name}</div>
                            <div className="text-xs text-text-muted flex items-center mt-0.5">
                              <User size={12} className="mr-1" />
                              <span>{req.requested_by_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-xs text-text">{req.site_location || 'Not Specified'}</td>
                          <td className="px-5 py-4 max-w-xs truncate" title={itemsSummary}>{itemsSummary}</td>
                          <td className="px-5 py-4 whitespace-nowrap text-xs text-text">{req.needed_from}</td>
                          <td className="px-5 py-4 whitespace-nowrap text-right text-xs">
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
            </div>
          </div>
          
          <div className="p-4 bg-background/25 border-t border-border flex justify-between items-center text-xs">
            <span className="text-text-muted font-medium">To edit threshold config, go to settings.</span>
            <Link href="/settings" className="text-primary font-semibold hover:underline flex items-center space-x-1">
              <span>Go to Settings</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* Pending Cash Requests Table section */}
      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-bold text-navy">Pending Petty Cash Decisions</h3>
          <p className="text-xs text-text-muted">Cash advance requests submitted by PMs awaiting approval decision</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                <th className="px-5 py-3">PM Requester</th>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Purpose</th>
                <th className="px-5 py-3">Amount Requested</th>
                <th className="px-5 py-3">Expected Deadline</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingCashRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-xs text-text-muted italic">
                    No petty cash requests currently pending approval.
                  </td>
                </tr>
              ) : (
                pendingCashRequests.map(adv => (
                  <tr key={adv.id} className="hover:bg-background/40 transition-colors">
                    <td className="px-5 py-4 font-semibold text-text">{adv.requested_by_name || 'PM Operator'}</td>
                    <td className="px-5 py-4 font-semibold text-navy">{adv.project_name}</td>
                    <td className="px-5 py-4 text-xs text-text-muted truncate max-w-xs">{adv.purpose}</td>
                    <td className="px-5 py-4 font-bold text-primary">{formatCurrency(adv.amount_requested_ugx)}</td>
                    <td className="px-5 py-4 text-xs text-text">{adv.expected_retirement_date}</td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href="/advances"
                        className="inline-flex items-center space-x-1 bg-warning text-white hover:bg-warning/95 rounded px-3 h-8 font-semibold transition-colors text-xs"
                      >
                        <span>Go Review</span>
                        <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Doughnut Chart */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-navy">Asset Status Distribution</h3>
            <p className="text-xs text-text-muted">Proportion of physical inventory across lifecycle states</p>
          </div>
          <div className="h-64">
            {(() => {
              const statusCounts = {
                available: equipment.filter(e => e.status === 'available').length,
                checked_out: equipment.filter(e => e.status === 'checked_out').length,
                overdue: equipment.filter(e => e.status === 'overdue').length,
                under_repair: equipment.filter(e => e.status === 'under_repair').length,
                retired: equipment.filter(e => e.status === 'retired').length
              };

              const pieData = [
                { name: 'Available', value: statusCounts.available, color: '#10B981' },
                { name: 'Checked Out', value: statusCounts.checked_out, color: '#3B82F6' },
                { name: 'Overdue', value: statusCounts.overdue, color: '#F59E0B' },
                { name: 'Under Repair', value: statusCounts.under_repair, color: '#EF4444' },
                { name: 'Retired', value: statusCounts.retired, color: '#9CA3AF' }
              ].filter(d => d.value > 0);

              if (pieData.length === 0) {
                return (
                  <div className="h-full flex items-center justify-center text-xs text-text-muted italic">
                    No active inventory status records found.
                  </div>
                );
              }

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} items`, 'Count']} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>

        {/* Line Chart */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-navy">Stock Movement Trends</h3>
            <p className="text-xs text-text-muted">Comparison of stock ingest vs consumption &amp; checkouts</p>
          </div>
          <div className="h-64">
            {(() => {
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const now = new Date();
              const lineData = [];

              for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthIdx = d.getMonth();
                const monthYearStr = `${months[monthIdx]} ${d.getFullYear().toString().substring(2)}`;
                
                const monthTxs = transactions.filter(tx => {
                  const txDate = new Date(tx.created_at);
                  return txDate.getMonth() === monthIdx && txDate.getFullYear() === d.getFullYear();
                });

                const added = monthTxs.filter(tx => tx.transaction_type === 'stock_added').length;
                const consumed = monthTxs.filter(tx => tx.transaction_type === 'stock_consumed' || tx.transaction_type === 'checkout').length;

                lineData.push({
                  name: monthYearStr,
                  Added: added,
                  'Consumed': consumed
                });
              }

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" style={{ fontSize: '10px' }} />
                    <YAxis style={{ fontSize: '10px' }} />
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                    <Line 
                      type="monotone" 
                      dataKey="Added" 
                      stroke="#3B82F6" 
                      strokeWidth={2.5} 
                      dot={{ r: 4 }} 
                      activeDot={{ r: 6 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Consumed" 
                      stroke="#F59E0B" 
                      strokeWidth={2.5} 
                      dot={{ r: 4 }} 
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
