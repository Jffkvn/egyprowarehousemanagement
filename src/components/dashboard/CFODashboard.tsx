"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Request, Equipment, ConsumableStock, Category } from '@/lib/db';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allReqs = await db.getRequests();
        const allEq = await db.getEquipment();
        const allCons = await db.getConsumables();
        const allCats = await db.getCategories();
        const allTxs = await db.getTransactions();
        
        setRequests(allReqs);
        setEquipment(allEq);
        setConsumables(allCons);
        setCategories(allCats);
        setTransactions(allTxs);
      } catch (err) {
        console.error('Error fetching CFO dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // CFO Card Counts
  // Card 1: Total value of all equipment (reusable + consumables)
  const totalReusableValue = equipment.reduce((sum, item) => sum + parseFloat(item.unit_value_ugx.toString()), 0);
  const totalConsumableValue = consumables.reduce((sum, item) => sum + (parseFloat(item.unit_value_ugx.toString()) * parseFloat(item.quantity_on_hand.toString())), 0);
  const totalValueUgx = totalReusableValue + totalConsumableValue;

  // Card 2: Items Checked Out
  const checkedOutCount = equipment.filter(e => e.status === 'checked_out' || e.status === 'overdue').length;

  // Card 3: Pending CFO approval
  const pendingCfoApprovals = requests.filter(r => r.status === 'pending' && r.routed_to === 'cfo');

  // Card 4: Low stock alerts
  const lowStockCount = consumables.filter(c => c.quantity_on_hand <= c.reorder_level).length;

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-navy">CFO Financial & Inventory Dashboard</h2>
        <p className="text-sm text-text-muted">Oversee capital expenditure, high-value approvals, and asset value metrics</p>
      </div>

      {/* Overview Cards */}
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
            <div className="text-lg font-bold text-navy">{parseFloat(totalValueUgx.toString()).toLocaleString()} UGX</div>
            <div className="text-xs text-text-muted font-medium">Total Equipment Value</div>
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
            <div className="text-xs text-text-muted font-medium">Items Checked Out</div>
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
            <div className="text-xs text-text-muted font-medium">Pending My Approval</div>
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
                    <span className="text-navy">{parseFloat(cv.value.toString()).toLocaleString()} UGX</span>
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
              <p className="text-xs text-text-muted">Requests routed to CFO awaiting financial review</p>
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
                        No requests currently routed for CFO approval.
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
