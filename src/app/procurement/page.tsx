"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, ProcurementRequest, Category } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { Plus, X, Search, Check, ShoppingBag, Truck, CheckCircle } from 'lucide-react';

export default function ProcurementPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [procurements, setProcurements] = useState<ProcurementRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create procurement request form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      const prs = await db.getProcurements();
      const cats = await db.getCategories();
      setProcurements(prs);
      setCategories(cats);
      if (cats.length > 0) setSelectedCatId(cats[0].id);
    } catch (err) {
      console.error('Error fetching procurement details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'pm') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user, router]);

  const handleCreateProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!description || !selectedCatId || !estimatedCost || !quantity) {
      setFormError('Please fill in all fields.');
      return;
    }

    setActionLoading(true);
    setFormError(null);

    try {
      await db.createProcurement({
        category_id: selectedCatId,
        description,
        estimated_cost_ugx: parseFloat(estimatedCost),
        quantity: parseInt(quantity),
        created_by: user.id
      });
      setIsModalOpen(false);
      setDescription('');
      setEstimatedCost('');
      setQuantity('1');
      fetchData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit procurement request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (prId: string, status: 'ordered' | 'received') => {
    if (!user) return;
    setActionLoading(true);
    try {
      await db.receiveProcurement(prId, user.id, status);
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update procurement request.');
    } finally {
      setActionLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    requested: 'bg-warning-tint text-warning border-warning/20',
    ordered: 'bg-primary/10 text-primary border-primary/20',
    received: 'bg-success-tint text-success border-success/20'
  };

  const isCFO = user?.role === 'cfo';
  const isWM = user?.role === 'warehouse_manager';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-navy">Procurement Tracker</h2>
          <p className="text-sm text-text-muted">Track capital procurement pipelines and mark orders received into inventory</p>
        </div>
        {isCFO && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-md px-4 h-10 transition-colors"
          >
            <Plus size={16} />
            <span>Procure Stock</span>
          </button>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-background/25">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Procurement Pipeline</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Qty Requested</th>
                <th className="px-6 py-3">Estimated Cost</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created By</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {procurements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-xs text-text-muted italic">
                    No procurement records logged.
                  </td>
                </tr>
              ) : (
                procurements.map(pr => (
                  <tr key={pr.id} className="hover:bg-background/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-navy">{pr.description}</td>
                    <td className="px-6 py-4 text-xs text-text">{pr.category_name}</td>
                    <td className="px-6 py-4 text-text">{pr.quantity} units</td>
                    <td className="px-6 py-4 text-xs text-text font-semibold">
                      {parseFloat(pr.estimated_cost_ugx.toString()).toLocaleString()} UGX
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[pr.status] || ''}`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-text-muted">{pr.created_by_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      {pr.status === 'requested' && isWM && (
                        <button
                          onClick={() => handleUpdateStatus(pr.id, 'ordered')}
                          disabled={actionLoading}
                          className="inline-flex items-center space-x-1 border border-primary text-primary hover:bg-primary/5 rounded px-2.5 h-8 font-semibold transition-colors mr-1.5"
                        >
                          <Truck size={12} />
                          <span>Order</span>
                        </button>
                      )}
                      
                      {pr.status === 'ordered' && isWM && (
                        <button
                          onClick={() => handleUpdateStatus(pr.id, 'received')}
                          disabled={actionLoading}
                          className="inline-flex items-center space-x-1 bg-primary text-white hover:bg-primary/95 rounded px-2.5 h-8 font-semibold transition-colors"
                        >
                          <CheckCircle size={12} />
                          <span>Mark Received</span>
                        </button>
                      )}

                      {pr.status === 'received' && (
                        <span className="text-success font-semibold flex items-center justify-end text-xs mr-3">
                          <Check size={12} className="mr-1" />
                          Stock Intake Synced
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CFO Create Procurement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="h-14 border-b border-border px-6 flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy">New Procurement Request</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProcurement} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-danger-tint border border-danger/25 text-danger rounded-md text-xs font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Item Category <span className="text-danger">*</span>
                </label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.item_type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Description / Specification <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  placeholder="e.g. Caterpillar Diesel Gen 10kVA"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Total Estimated Cost (UGX) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                    placeholder="e.g. 15000000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Quantity <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 h-10 border border-border text-text rounded-md text-sm font-semibold hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 h-10 bg-primary hover:bg-primary/95 text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center"
                >
                  {actionLoading ? 'Creating...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
