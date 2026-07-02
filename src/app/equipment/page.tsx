"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Equipment, ConsumableStock, Category } from '@/lib/db';
import { StatusBadge } from '@/components/dashboard/PMDashboard';
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  Package, 
  Database, 
  AlertCircle, 
  CheckCircle,
  FileText,
  Printer,
  QrCode
} from 'lucide-react';
import QRCode from 'qrcode';

export default function CatalogPage() {
  const { user } = useAuth();
  
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [consumables, setConsumables] = useState<ConsumableStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Print & Selection States
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [selectedConsumableIds, setSelectedConsumableIds] = useState<string[]>([]);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printLabelsList, setPrintLabelsList] = useState<Array<{
    id: string;
    code: string;
    name: string;
    labelCode: string;
    qrDataUrl?: string;
  }>>([]);

  // Search/Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeCatalogTab, setActiveCatalogTab] = useState<'reusable' | 'consumable'>('consumable');

  // Add Item Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState<'reusable' | 'consumable'>('consumable');
  const [catName, setCatName] = useState('');
  const [catPrefix, setCatPrefix] = useState('');
  const [catType, setCatType] = useState<'reusable' | 'consumable'>('reusable');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Form inputs
  const [selectedCatId, setSelectedCatId] = useState('');
  const [itemName, setItemName] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [serialNumber, setSerialNumber] = useState('');
  const [location, setLocation] = useState('Kampala Central Warehouse');
  const [conditionNotes, setConditionNotes] = useState('');
  const [reorderLevel, setReorderLevel] = useState('10');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // CFO Editing values state
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const handleUpdateUnitValue = async (id: string, type: 'reusable' | 'consumable', valueStr: string) => {
    if (valueStr === undefined || valueStr === '') return;
    const parsed = parseFloat(valueStr);
    if (isNaN(parsed) || parsed < 0) return;
    try {
      await db.updateItemValue(id, type, parsed);
      // Clean up editing state for this item
      const updated = { ...editingValues };
      delete updated[id];
      setEditingValues(updated);
      fetchData();
    } catch (err) {
      console.error('Error updating item value:', err);
    }
  };

  const fetchData = async () => {
    try {
      const eqs = await db.getEquipment();
      const cons = await db.getConsumables();
      const cats = await db.getCategories();
      setEquipment(eqs);
      setConsumables(cons);
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get('status');
      if (statusParam === 'low_stock') {
        setSelectedStatus('low_stock');
        setActiveCatalogTab('consumable');
      } else if (statusParam === 'checked_out') {
        setSelectedStatus('checked_out');
        setActiveCatalogTab('reusable');
      } else if (statusParam === 'available') {
        setSelectedStatus('available');
      }
    }
  }, []);

  const handlePrintSingle = async (item: Equipment | ConsumableStock, type: 'reusable' | 'consumable') => {
    try {
      const labelCode = type === 'reusable' ? `EQPT:${item.id}` : `CONS:${item.id}`;
      const qrDataUrl = await QRCode.toDataURL(labelCode, { 
        errorCorrectionLevel: 'H', 
        margin: 2, 
        width: 256 
      });

      // Update printed_at timestamp in database
      let labelId = '';
      if (type === 'reusable') {
        const found = item as Equipment;
        if (found.qr_label_id) labelId = found.qr_label_id;
      } else {
        const found = item as ConsumableStock;
        if (found.qr_label_id) labelId = found.qr_label_id;
      }

      if (labelId) {
        await db.markQrLabelPrinted(labelId);
      }

      setPrintLabelsList([{
        id: item.id,
        code: type === 'reusable' ? (item as Equipment).asset_code : (item as ConsumableStock).sku_code,
        name: item.name,
        labelCode,
        qrDataUrl
      }]);
      setPrintModalOpen(true);
    } catch (err) {
      console.error('Failed to generate QR:', err);
      alert('Failed to generate QR label');
    }
  };

  const handlePrintBatch = async () => {
    const labels: typeof printLabelsList = [];
    try {
      for (const eqId of selectedEquipmentIds) {
        const eq = equipment.find(e => e.id === eqId);
        if (eq) {
          const labelCode = `EQPT:${eq.id}`;
          const qrDataUrl = await QRCode.toDataURL(labelCode, { 
            errorCorrectionLevel: 'H', 
            margin: 2, 
            width: 256 
          });
          labels.push({
            id: eq.id,
            code: eq.asset_code,
            name: eq.name,
            labelCode,
            qrDataUrl
          });
          if (eq.qr_label_id) {
            await db.markQrLabelPrinted(eq.qr_label_id);
          }
        }
      }

      for (const conId of selectedConsumableIds) {
        const con = consumables.find(c => c.id === conId);
        if (con) {
          const labelCode = `CONS:${con.id}`;
          const qrDataUrl = await QRCode.toDataURL(labelCode, { 
            errorCorrectionLevel: 'H', 
            margin: 2, 
            width: 256 
          });
          labels.push({
            id: con.id,
            code: con.sku_code,
            name: con.name,
            labelCode,
            qrDataUrl
          });
          if (con.qr_label_id) {
            await db.markQrLabelPrinted(con.qr_label_id);
          }
        }
      }

      if (labels.length === 0) return;
      setPrintLabelsList(labels);
      setPrintModalOpen(true);
    } catch (err) {
      console.error('Failed to generate batch QRs:', err);
      alert('Failed to generate QR labels');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName || !catPrefix) return;

    try {
      await db.addCategory({
        name: catName,
        code_prefix: catPrefix.toUpperCase(),
        item_type: catType
      });
      setCatName('');
      setCatPrefix('');
      setIsCategoryModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to add category');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!selectedCatId || !itemName || !quantity) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      if (formType === 'reusable') {
        await db.addEquipment({
          category_id: selectedCatId,
          name: itemName,
          unit_value_ugx: unitValue ? parseFloat(unitValue) : 0,
          manufacturer_serial: serialNumber || undefined,
          current_location: location || undefined,
          condition_notes: conditionNotes || undefined,
          created_by: user.id
        }, parseInt(quantity));
      } else {
        await db.addConsumable({
          category_id: selectedCatId,
          name: itemName,
          unit_value_ugx: unitValue ? parseFloat(unitValue) : 0,
          quantity_on_hand: parseFloat(quantity),
          reorder_level: parseFloat(reorderLevel),
          created_by: user.id
        });
      }

      setSuccessMsg('Stock added successfully!');
      setTimeout(() => {
        setSuccessMsg(null);
        setIsModalOpen(false);
        // Reset form fields
        setItemName('');
        setUnitValue('');
        setQuantity('1');
        setSerialNumber('');
        setConditionNotes('');
        fetchData();
      }, 1500);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to add stock item.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Logic
  const filteredEqs = equipment.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || 
                          e.asset_code.toLowerCase().includes(search.toLowerCase()) ||
                          (e.manufacturer_serial && e.manufacturer_serial.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || e.category_id === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || e.status === selectedStatus;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const filteredCons = consumables.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          c.sku_code.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || c.category_id === selectedCategory;
    
    // Consumables status logic (e.g. low stock alerts)
    let matchesStatus = true;
    if (selectedStatus === 'low_stock') {
      matchesStatus = c.quantity_on_hand <= c.reorder_level;
    } else if (selectedStatus === 'available') {
      matchesStatus = c.quantity_on_hand > 0;
    }
    
    return matchesSearch && matchesCat && matchesStatus;
  });

  const isEditor = user?.role === 'warehouse_manager' || user?.role === 'cfo';
  const isCFO = user?.role === 'cfo';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Egypro Inventory Catalog</h2>
          <p className="text-sm text-text-muted">Live stock counts and equipment status tracking</p>
        </div>
        {isEditor && (
          <div className="flex space-x-2">
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="inline-flex items-center justify-center space-x-1.5 border border-border bg-surface text-text hover:bg-background font-semibold text-xs rounded-md px-3 h-10 transition-colors"
            >
              <span>Add Category</span>
            </button>
            <button 
              onClick={() => {
                setFormType('consumable');
                const consumableCats = categories.filter(c => c.item_type === 'consumable');
                if (consumableCats.length > 0) {
                  setSelectedCatId(consumableCats[0].id);
                } else if (categories.length > 0) {
                  setSelectedCatId(categories[0].id);
                }
                setIsModalOpen(true);
              }}
              className="inline-flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-md px-4 h-10 transition-colors"
            >
              <Plus size={16} />
              <span>Add Stock</span>
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters panel */}
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col sm:flex-row items-center gap-3 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search code, name, serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter size={14} className="text-text-muted hidden sm:inline" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary flex-1 sm:flex-initial"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.item_type})</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary flex-1 sm:flex-initial"
          >
            <option value="all">All Statuses</option>
            {activeCatalogTab === 'reusable' ? (
              <>
                <option value="available">Available</option>
                <option value="checked_out">Checked Out</option>
                <option value="overdue">Overdue</option>
                <option value="under_repair">Under Repair</option>
                <option value="retired">Retired</option>
              </>
            ) : (
              <>
                <option value="available">In Stock</option>
                <option value="low_stock">Low Stock Alerts</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Catalog Tabs */}
      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-border bg-background/25">
          <button
            onClick={() => {
              setActiveCatalogTab('consumable');
              setSelectedStatus('all');
            }}
            className={`px-6 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center space-x-2
              ${activeCatalogTab === 'consumable' 
                ? 'border-primary text-primary bg-surface' 
                : 'border-transparent text-text-muted hover:text-navy'}
            `}
          >
            <Database size={16} />
            <span>Consumables Stock ({filteredCons.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveCatalogTab('reusable');
              setSelectedStatus('all');
            }}
            className={`px-6 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center space-x-2
              ${activeCatalogTab === 'reusable' 
                ? 'border-primary text-primary bg-surface' 
                : 'border-transparent text-text-muted hover:text-navy'}
            `}
          >
            <Package size={16} />
            <span>Reusable Equipment ({filteredEqs.length})</span>
          </button>
        </div>

        {/* Catalog Table */}
        <div className="overflow-x-auto">
          {activeCatalogTab === 'reusable' ? (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                  <th className="px-6 py-3 w-10">
                    <input 
                      type="checkbox"
                      checked={selectedEquipmentIds.length === filteredEqs.length && filteredEqs.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEquipmentIds(filteredEqs.map(eq => eq.id));
                        } else {
                          setSelectedEquipmentIds([]);
                        }
                      }}
                      className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
                    />
                  </th>
                  <th className="px-6 py-3">Asset Code</th>
                  <th className="px-6 py-3">Equipment Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Serial Number</th>
                  <th className="px-6 py-3">Unit Value</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Current Location</th>
                  <th className="px-6 py-3 text-right">QR Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEqs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-xs text-text-muted italic">
                      No matching equipment in catalog.
                    </td>
                  </tr>
                ) : (
                  filteredEqs.map(item => {
                    const cat = categories.find(c => c.id === item.category_id);
                    return (
                      <tr key={item.id} className="hover:bg-background/40 transition-colors">
                        <td className="px-6 py-4">
                          <input 
                            type="checkbox"
                            checked={selectedEquipmentIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEquipmentIds([...selectedEquipmentIds, item.id]);
                              } else {
                                setSelectedEquipmentIds(selectedEquipmentIds.filter(id => id !== item.id));
                              }
                            }}
                            className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
                          />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-navy">{item.asset_code}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-text">{item.name}</div>
                          {item.condition_notes && (
                            <div className="text-[10px] text-text-muted max-w-[200px] truncate" title={item.condition_notes}>
                              {item.condition_notes}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-text">{cat?.name || 'Unassigned'}</td>
                        <td className="px-6 py-4 text-xs font-mono text-text-muted">{item.manufacturer_serial || '—'}</td>
                        <td className="px-6 py-4 text-xs font-semibold">
                          {isCFO ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                value={editingValues[item.id] !== undefined ? editingValues[item.id] : item.unit_value_ugx}
                                onChange={(e) => setEditingValues({ ...editingValues, [item.id]: e.target.value })}
                                onBlur={() => handleUpdateUnitValue(item.id, 'reusable', editingValues[item.id])}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateUnitValue(item.id, 'reusable', editingValues[item.id]);
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-24 h-8 px-2 border border-border rounded text-xs bg-background focus:outline-none focus:border-primary font-mono font-semibold"
                              />
                              <span className="text-[10px] text-text-muted">UGX</span>
                            </div>
                          ) : (
                            <span className="text-text">
                              {parseFloat(item.unit_value_ugx.toString()).toLocaleString()} UGX
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-6 py-4 text-xs text-text-muted">{item.current_location || 'Warehouse'}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handlePrintSingle(item, 'reusable')}
                            className="inline-flex items-center justify-center p-1.5 border border-border text-navy hover:bg-navy/5 rounded transition-all focus:outline-none"
                            title="Print QR label"
                          >
                            <Printer size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-background text-text-muted text-xs font-semibold uppercase border-b border-border">
                  <th className="px-6 py-3 w-10">
                    <input 
                      type="checkbox"
                      checked={selectedConsumableIds.length === filteredCons.length && filteredCons.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedConsumableIds(filteredCons.map(c => c.id));
                        } else {
                          setSelectedConsumableIds([]);
                        }
                      }}
                      className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
                    />
                  </th>
                  <th className="px-6 py-3">SKU Code</th>
                  <th className="px-6 py-3">Item Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Unit Value</th>
                  <th className="px-6 py-3">Quantity On Hand</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">QR Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCons.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-xs text-text-muted italic">
                      No matching consumables in catalog.
                    </td>
                  </tr>
                ) : (
                  filteredCons.map(item => {
                    const cat = categories.find(c => c.id === item.category_id);
                    const isLow = item.quantity_on_hand <= item.reorder_level;
                    return (
                      <tr key={item.id} className="hover:bg-background/40 transition-colors">
                        <td className="px-6 py-4">
                          <input 
                            type="checkbox"
                            checked={selectedConsumableIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedConsumableIds([...selectedConsumableIds, item.id]);
                              } else {
                                setSelectedConsumableIds(selectedConsumableIds.filter(id => id !== item.id));
                              }
                            }}
                            className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
                          />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-navy">{item.sku_code}</td>
                        <td className="px-6 py-4 font-semibold text-text">{item.name}</td>
                        <td className="px-6 py-4 text-xs text-text">{cat?.name || 'Unassigned'}</td>
                        <td className="px-6 py-4 text-xs font-semibold">
                          {isCFO ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                value={editingValues[item.id] !== undefined ? editingValues[item.id] : item.unit_value_ugx}
                                onChange={(e) => setEditingValues({ ...editingValues, [item.id]: e.target.value })}
                                onBlur={() => handleUpdateUnitValue(item.id, 'consumable', editingValues[item.id])}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateUnitValue(item.id, 'consumable', editingValues[item.id]);
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-24 h-8 px-2 border border-border rounded text-xs bg-background focus:outline-none focus:border-primary font-mono font-semibold"
                              />
                              <span className="text-[10px] text-text-muted">UGX</span>
                            </div>
                          ) : (
                            <span className="text-text">
                              {parseFloat(item.unit_value_ugx.toString()).toLocaleString()} UGX
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-text">
                          {item.quantity_on_hand} units
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isLow ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-danger-tint text-danger border border-danger/10">
                              Low Stock (Reorder: {item.reorder_level})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-tint text-success border border-success/10">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handlePrintSingle(item, 'consumable')}
                            className="inline-flex items-center justify-center p-1.5 border border-border text-navy hover:bg-navy/5 rounded transition-all focus:outline-none"
                            title="Print QR label"
                          >
                            <Printer size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Stock Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-lg overflow-hidden my-8">
            <div className="h-14 border-b border-border px-6 flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Add Equipment / Receive Stock</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-danger-tint border border-danger/25 text-danger rounded-md text-xs font-medium flex items-center">
                  <AlertCircle size={14} className="mr-2 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-success-tint border border-success/25 text-success rounded-md text-xs font-medium flex items-center">
                  <CheckCircle size={14} className="mr-2 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form Type Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-background border border-border rounded-md">
                <button
                  type="button"
                  onClick={() => {
                    setFormType('consumable');
                    // Pick first consumable category
                    const consumableCats = categories.filter(c => c.item_type === 'consumable');
                    if (consumableCats.length > 0) setSelectedCatId(consumableCats[0].id);
                  }}
                  className={`py-2 text-xs font-semibold rounded transition-colors
                    ${formType === 'consumable' 
                      ? 'bg-white text-navy shadow-sm' 
                      : 'text-text-muted hover:text-text'}
                  `}
                >
                  Consumable Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('reusable');
                    // Pick first reusable category
                    const reusableCats = categories.filter(c => c.item_type === 'reusable');
                    if (reusableCats.length > 0) setSelectedCatId(reusableCats[0].id);
                  }}
                  className={`py-2 text-xs font-semibold rounded transition-colors
                    ${formType === 'reusable' 
                      ? 'bg-white text-navy shadow-sm' 
                      : 'text-text-muted hover:text-text'}
                  `}
                >
                  Reusable Item
                </button>
              </div>

              {/* Category Picker */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Equipment Category <span className="text-danger">*</span>
                </label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                >
                  {categories
                    .filter(c => c.item_type === formType)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code_prefix})</option>
                    ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Item Description / Model <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  placeholder={formType === 'reusable' ? 'e.g. Honda EU22i Generator' : 'e.g. Cat6 Cable (per meter)'}
                />
              </div>

              {/* Value and Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Unit Value (UGX) <span className="text-text-muted">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={unitValue}
                    onChange={(e) => setUnitValue(e.target.value)}
                    className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                    placeholder="e.g. 500000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    {formType === 'reusable' ? 'Quantity to Create' : 'Quantity Received (m/units)'} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {formType === 'reusable' ? (
                /* Reusable specific fields */
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-text mb-1">
                      Manufacturer Serial (optional)
                    </label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                      placeholder="e.g. SN-9104-B"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-text mb-1">
                      Initial Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-text mb-1">
                      Condition Intake Notes (optional)
                    </label>
                    <textarea
                      value={conditionNotes}
                      onChange={(e) => setConditionNotes(e.target.value)}
                      className="w-full h-20 p-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary resize-none"
                      placeholder="e.g. Factory fresh, tested good."
                    />
                  </div>
                </div>
              ) : (
                /* Consumable specific fields */
                <div className="border-t border-border pt-4">
                  <div>
                    <div className="flex items-center space-x-1.5 mb-1">
                      <label className="block text-xs font-semibold text-text">
                        Reorder Threshold Level <span className="text-danger">*</span>
                      </label>
                      <div className="group relative inline-block">
                        <span className="cursor-help inline-flex items-center justify-center w-4 h-4 rounded-full bg-background border border-border text-[10px] font-bold text-text-muted hover:bg-neutral/15 hover:text-text transition-colors">
                          ?
                        </span>
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2.5 bg-navy text-white text-[10px] rounded shadow-lg z-50 font-normal leading-relaxed">
                          The minimum quantity level for this item. When warehouse stock falls below this number, the dashboard alerts with a "Low Stock" warning.
                        </div>
                      </div>
                    </div>
                    <input
                      type="number"
                      required
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(e.target.value)}
                      className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Triggers a low-stock alert when the warehouse quantity falls below this value.
                    </p>
                  </div>
                </div>
              )}

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
                  disabled={submitting}
                  className="px-4 h-10 bg-primary hover:bg-primary/95 text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Log stock intake'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Creation Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="h-14 border-b border-border px-6 flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy">Add New Equipment Category</h3>
              <button 
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-text-muted hover:text-text p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Category Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                  placeholder="e.g. Generators, Tower Tools"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Code Prefix <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={3}
                  value={catPrefix}
                  onChange={(e) => setCatPrefix(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary uppercase"
                  placeholder="e.g. GEN, TWR, CAB"
                />
                <p className="text-[10px] text-text-muted mt-1">Maximum 3 letters. Used to auto-generate asset numbers.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Item Tracking Type <span className="text-danger">*</span>
                </label>
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as any)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary"
                >
                  <option value="reusable">Reusable Pool (Tracked Individually)</option>
                  <option value="consumable">Consumable Count (Tracked by SKU total)</option>
                </select>
              </div>

              <div className="border-t border-border pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 h-10 border border-border text-text rounded-md text-sm font-semibold hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 h-10 bg-primary hover:bg-primary/95 text-white rounded-md text-sm font-semibold transition-colors"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Bar for Batch Print */}
      {(selectedEquipmentIds.length > 0 || selectedConsumableIds.length > 0) && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-navy text-white px-6 py-4 rounded-xl shadow-2xl border border-white/10 flex items-center space-x-6 animate-scale-up">
          <div className="text-xs font-semibold">
            {selectedEquipmentIds.length + selectedConsumableIds.length} labels selected for printing
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setSelectedEquipmentIds([]);
                setSelectedConsumableIds([]);
              }}
              className="px-3 h-8 border border-white/15 hover:bg-white/5 rounded text-xs font-semibold transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={handlePrintBatch}
              className="px-4 h-8 bg-primary hover:bg-primary/95 text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1.5"
            >
              <Printer size={12} />
              <span>Print QR Labels</span>
            </button>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs print:hidden">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-background">
              <div>
                <h3 className="text-sm font-bold text-navy">Print QR Labels</h3>
                <p className="text-[10px] text-text-muted">Brother DK-11209 Layout Preview (62mm x 90mm)</p>
              </div>
              <button 
                onClick={() => {
                  setPrintModalOpen(false);
                  setPrintLabelsList([]);
                }}
                className="text-text-muted hover:text-text p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-background/50 grid grid-cols-2 gap-4">
              {printLabelsList.map(label => (
                <div key={label.id} className="bg-white text-black p-4 rounded border border-border shadow-xs flex flex-col items-center justify-between aspect-[62/90] max-w-[200px] mx-auto">
                  {/* Egypro Logo Mock */}
                  <div className="w-full flex items-center justify-center border-b border-black/10 pb-1 mb-2">
                    <span className="font-bold text-[10px] text-slate-700 font-mono tracking-wider">EGYPRO LOGISTICS</span>
                  </div>

                  {/* QR Image */}
                  {label.qrDataUrl && (
                    <img 
                      src={label.qrDataUrl} 
                      alt={label.code} 
                      className="w-32 h-32 object-contain"
                    />
                  )}

                  {/* Descriptions */}
                  <div className="w-full text-center mt-2 space-y-0.5">
                    <div className="font-bold font-mono text-[13px] text-black leading-none">{label.code}</div>
                    <div className="text-[9px] text-slate-600 truncate max-w-full leading-tight">{label.name}</div>
                    <div className="font-mono text-[7px] text-slate-400">{label.labelCode}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Print Area inside DOM (hidden in screen, visible in print) */}
            <div className="print-area hidden">
              {printLabelsList.map(label => (
                <div key={label.id} className="label-print-card bg-white text-black p-6 border border-slate-300 flex flex-col items-center justify-between mx-auto" style={{ width: '62mm', height: '90mm', pageBreakInside: 'avoid' }}>
                  <div className="w-full text-center border-b border-black/20 pb-1 mb-2 font-mono font-bold text-[10px] tracking-wider text-slate-700">
                    EGYPRO LOGISTICS
                  </div>
                  {label.qrDataUrl && (
                    <img src={label.qrDataUrl} alt={label.code} style={{ width: '42mm', height: '42mm' }} />
                  )}
                  <div className="w-full text-center mt-2">
                    <div className="font-bold font-mono text-[14px] leading-none text-black">{label.code}</div>
                    <div className="text-[9px] text-slate-700 truncate max-w-full font-semibold">{label.name}</div>
                    <div className="font-mono text-[7px] text-slate-400">{label.labelCode}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-4 flex justify-end space-x-3 bg-background/25">
              <button
                type="button"
                onClick={() => {
                  setPrintModalOpen(false);
                  setPrintLabelsList([]);
                }}
                className="px-4 h-9 border border-border text-text rounded text-xs font-semibold hover:bg-background transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 h-9 bg-primary hover:bg-primary/95 text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1.5"
              >
                <Printer size={14} />
                <span>Trigger Print</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal CSS styles for print layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-area, .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 15px !important;
            background: white !important;
          }
          .label-print-card {
            border: 1px solid #ccc !important;
            background: white !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />
    </div>
  );
}
