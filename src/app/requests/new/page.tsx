"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Equipment, ConsumableStock, Category } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Calendar, MapPin, ClipboardList, Check } from 'lucide-react';

interface SelectedItem {
  id: string; // React key
  equipmentId?: string;
  consumableId?: string;
  name: string;
  type: 'reusable' | 'consumable';
  code: string;
  unitValue: number;
  availableCount: number;
  quantityRequested: number;
}

export default function NewRequestPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [projectName, setProjectName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [neededFrom, setNeededFrom] = useState('');
  const [neededUntil, setNeededUntil] = useState('');
  
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [availableConsumables, setAvailableConsumables] = useState<ConsumableStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eqs = await db.getEquipment();
        const cons = await db.getConsumables();
        const cats = await db.getCategories();
        
        // Show only available equipment
        setAvailableEquipment(eqs.filter(e => e.status === 'available'));
        setAvailableConsumables(cons);
        setCategories(cats);
      } catch (err) {
        console.error('Error fetching catalog data:', err);
      }
    };
    fetchData();
  }, []);

  // Determine if we need the "Needed Until" date (required if any selected item is reusable)
  const hasReusableItem = selectedItems.some(item => item.type === 'reusable');

  const addItemToRequest = (item: Equipment | ConsumableStock, type: 'reusable' | 'consumable') => {
    // Prevent adding the same item twice
    const itemExists = selectedItems.some(i => 
      type === 'reusable' ? i.equipmentId === item.id : i.consumableId === item.id
    );

    if (itemExists) {
      setValidationError('This item has already been added to your request.');
      return;
    }

    setValidationError(null);

    const isReusable = type === 'reusable';
    const eq = item as Equipment;
    const con = item as ConsumableStock;

    const newItem: SelectedItem = {
      id: Math.random().toString(36).substr(2, 9),
      equipmentId: isReusable ? eq.id : undefined,
      consumableId: !isReusable ? con.id : undefined,
      name: item.name,
      type: type,
      code: isReusable ? eq.asset_code : con.sku_code,
      unitValue: item.unit_value_ugx,
      availableCount: isReusable ? 1 : con.quantity_on_hand,
      quantityRequested: 1 // default
    };

    setSelectedItems([...selectedItems, newItem]);
    setSearchQuery('');
  };

  const removeItem = (id: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.id === id) {
        // Validate consumable quantity against stock
        const validQty = Math.max(1, Math.min(qty, item.availableCount));
        return { ...item, quantityRequested: validQty };
      }
      return item;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedItems.length === 0) {
      setValidationError('Please add at least one item to your request.');
      return;
    }

    if (hasReusableItem && !neededUntil) {
      setValidationError('Needed Until date is required for reusable tools.');
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    try {
      const itemsToSubmit = selectedItems.map(item => ({
        equipment_id: item.equipmentId,
        consumable_id: item.consumableId,
        quantity_requested: item.quantityRequested
      }));

      await db.createRequest({
        requested_by: user.id,
        project_name: projectName,
        site_location: siteLocation || undefined,
        needed_from: neededFrom,
        needed_until: hasReusableItem ? neededUntil : undefined
      }, itemsToSubmit);

      setToastMessage('Request sent');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to submit request.');
      setSubmitting(false);
    }
  };

  // Filter catalog items by search
  const filteredEqs = availableEquipment.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.asset_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCons = availableConsumables.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.sku_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center bg-success text-white px-4 py-3 rounded-md shadow-md text-sm font-semibold transition-all">
          <Check size={16} className="mr-2" />
          {toastMessage}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-navy">Submit Equipment Request</h2>
        <p className="text-sm text-text-muted">Request tools and materials for field installation sites</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Details Form */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-lg p-6 space-y-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Project Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  placeholder="e.g. ATC Mbarara Site Upgrade"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Site Location (optional)
                </label>
                <input
                  type="text"
                  value={siteLocation}
                  onChange={(e) => setSiteLocation(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  placeholder="GPS or Town Name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Needed From <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={neededFrom}
                  onChange={(e) => setNeededFrom(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                />
              </div>

              {hasReusableItem && (
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Needed Until <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={neededUntil}
                    onChange={(e) => setNeededUntil(e.target.value)}
                    min={neededFrom}
                    className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>

            {/* Selected Items Checklist */}
            <div className="border-t border-border pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-navy flex items-center">
                <ClipboardList size={16} className="mr-2 text-primary" />
                <span>Requested Items Checklist</span>
              </h3>

              {validationError && (
                <div className="p-3 bg-danger-tint border border-danger/20 text-danger rounded-md text-xs font-medium">
                  {validationError}
                </div>
              )}

              {selectedItems.length === 0 ? (
                <div className="text-center py-8 bg-background border border-dashed border-border rounded-md">
                  <p className="text-xs text-text-muted">No items selected yet. Choose items from the catalog picker on the right.</p>
                </div>
              ) : (
                <div className="border border-border rounded-md overflow-hidden bg-background">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface text-text-muted border-b border-border font-semibold uppercase">
                        <th className="px-4 py-2">Item / Code</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Available</th>
                        <th className="px-4 py-2 w-24">Qty</th>
                        <th className="px-4 py-2 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-surface">
                      {selectedItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-text">{item.name}</div>
                            <div className="text-[10px] text-text-muted">{item.code}</div>
                          </td>
                          <td className="px-4 py-3 capitalize">{item.type}</td>
                          <td className="px-4 py-3">
                            {item.type === 'reusable' ? (
                              <span className="text-success font-medium">In Stock</span>
                            ) : (
                              <span>{item.availableCount} m/units</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.type === 'reusable' ? (
                              <span className="font-semibold">1 unit</span>
                            ) : (
                              <input
                                type="number"
                                min={1}
                                max={item.availableCount}
                                value={item.quantityRequested}
                                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                                className="w-16 h-8 px-2 border border-border rounded text-xs bg-background text-center focus:outline-none focus:border-primary"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-text-muted hover:text-danger p-1 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-4 h-10 border border-border text-text rounded-md text-sm font-semibold hover:bg-background transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 h-10 bg-primary hover:bg-primary/95 text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Send request'}
              </button>
            </div>
          </form>
        </div>

        {/* Catalog Picker Panel */}
        <div className="bg-surface border border-border rounded-lg p-4 shadow-sm h-[600px] flex flex-col">
          <h3 className="text-sm font-bold text-navy mb-1">Catalog Item Picker</h3>
          <p className="text-xs text-text-muted mb-3">Add items from warehouse stock below</p>
          
          <input
            type="text"
            placeholder="Search items by name/code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary mb-4"
          />

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Reusable Equipment Section */}
            <div>
              <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Reusable Equipment</h4>
              {filteredEqs.length === 0 ? (
                <p className="text-[11px] text-text-muted italic px-2">No available equipment found</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredEqs.map(item => (
                    <div 
                      key={item.id}
                      className="p-2.5 bg-background hover:bg-primary/5 border border-border hover:border-primary/30 rounded-md transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-navy truncate">{item.name}</div>
                        <div className="text-[9px] text-text-muted font-mono">{item.asset_code}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addItemToRequest(item, 'reusable')}
                        className="p-1 bg-white hover:bg-primary text-text-muted hover:text-white border border-border hover:border-primary rounded transition-all flex-shrink-0"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Consumable Stock Section */}
            <div>
              <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Consumable Stock</h4>
              {filteredCons.length === 0 ? (
                <p className="text-[11px] text-text-muted italic px-2">No consumables found</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredCons.map(item => {
                    const isOutOfStock = item.quantity_on_hand <= 0;
                    return (
                      <div 
                        key={item.id}
                        className={`p-2.5 bg-background border rounded-md flex items-center justify-between group
                          ${isOutOfStock ? 'opacity-50 border-border' : 'hover:bg-primary/5 border-border hover:border-primary/30 transition-all'}
                        `}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold text-navy truncate">{item.name}</div>
                          <div className="text-[9px] text-text-muted font-mono mb-1">{item.sku_code}</div>
                          <div className={`text-[10px] font-medium ${isOutOfStock ? 'text-danger' : 'text-text-muted'}`}>
                            Stock: {item.quantity_on_hand} available
                          </div>
                        </div>
                        {!isOutOfStock && (
                          <button
                            type="button"
                            onClick={() => addItemToRequest(item, 'consumable')}
                            className="p-1 bg-white hover:bg-primary text-text-muted hover:text-white border border-border hover:border-primary rounded transition-all flex-shrink-0"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
