"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Category, GrnDocument, GrnItem } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Printer, 
  ArrowLeft, 
  Check, 
  AlertCircle,
  FileText,
  Truck,
  FileSpreadsheet,
  X
} from 'lucide-react';
import QRCode from 'qrcode';

interface GRNLineInput {
  id: string;
  item_type: 'reusable' | 'consumable';
  category_id: string;
  name: string;
  quantity_received: number;
  unit_value_ugx: number;
  condition_on_arrival: 'good' | 'damaged' | 'pending_inspection';
  notes: string;
}

export default function StockReceivePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // GRN Header State
  const [supplierName, setSupplierName] = useState('');
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
  const [receivedAt, setReceivedAt] = useState(() => {
    const d = new Date();
    // Format to local ISO without seconds/timezone for datetime-local input
    return d.toISOString().substring(0, 16);
  });
  const [generalNotes, setGeneralNotes] = useState('');

  // GRN Lines State
  const [lines, setLines] = useState<GRNLineInput[]>([
    {
      id: Math.random().toString(),
      item_type: 'consumable',
      category_id: '',
      name: '',
      quantity_received: 10,
      unit_value_ugx: 0,
      condition_on_arrival: 'good',
      notes: ''
    }
  ]);

  // Post-submit State
  const [submittedGRN, setSubmittedGRN] = useState<GrnDocument | null>(null);
  const [submittedItems, setSubmittedItems] = useState<GrnItem[]>([]);
  
  // Printing QR Labels states
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printLabelsList, setPrintLabelsList] = useState<Array<{
    id: string;
    code: string;
    name: string;
    labelCode: string;
    qrDataUrl?: string;
  }>>([]);

  useEffect(() => {
    if (user && user.role === 'pm') {
      router.push('/dashboard');
      return;
    }

    const loadCategories = async () => {
      try {
        const cats = await db.getCategories();
        setCategories(cats);
        // Pre-fill line category if available
        if (cats.length > 0) {
          setLines(prev => prev.map(l => ({ ...l, category_id: l.category_id || cats[0].id })));
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, [user, router]);

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        item_type: 'consumable',
        category_id: categories[0]?.id || '',
        name: '',
        quantity_received: 10,
        unit_value_ugx: 0,
        condition_on_arrival: 'good',
        notes: ''
      }
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleLineChange = (id: string, field: keyof GRNLineInput, value: any) => {
    setLines(prev => prev.map(l => {
      if (l.id === id) {
        const updated = { ...l, [field]: value };
        // If switching to reusable, ensure quantity is forced to 1 for tracking individual asset numbers
        if (field === 'item_type' && value === 'reusable') {
          updated.quantity_received = 1;
        }
        return updated;
      }
      return l;
    }));
  };

  const calculateSubtotal = () => {
    return lines.reduce((total, line) => {
      const q = line.quantity_received || 0;
      const v = line.unit_value_ugx || 0;
      return total + (q * v);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Basic Validations
    for (const line of lines) {
      if (!line.category_id) {
        alert('Please specify a category for all lines.');
        return;
      }
      if (!line.name.trim()) {
        alert('Please specify an item name for all lines.');
        return;
      }
      if (line.quantity_received <= 0) {
        alert('Quantity must be greater than zero for all lines.');
        return;
      }
      if (line.unit_value_ugx < 0) {
        alert('Unit value cannot be negative.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const doc = await db.createGRNDocument(
        {
          received_by: user.id,
          supplier_name: supplierName || undefined,
          delivery_note_ref: deliveryNoteRef || undefined,
          received_at: new Date(receivedAt).toISOString(),
          notes: generalNotes || undefined
        },
        lines.map(l => ({
          item_type: l.item_type,
          category_id: l.category_id,
          name: l.name,
          quantity_received: l.quantity_received,
          unit_value_ugx: l.unit_value_ugx,
          condition_on_arrival: l.condition_on_arrival,
          notes: l.notes || undefined
        }))
      );

      // Fetch items generated
      const grnItems = await db.getGRNItems(doc.id);
      
      setSubmittedGRN(doc);
      setSubmittedItems(grnItems);
    } catch (err: any) {
      alert(err.message || 'Failed to submit GRN');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintDeliveryLabels = async () => {
    if (!submittedItems || submittedItems.length === 0) return;

    try {
      const eqs = await db.getEquipment();
      const cons = await db.getConsumables();
      const labels: typeof printLabelsList = [];

      for (const item of submittedItems) {
        if (item.equipment_id) {
          const eq = eqs.find(e => e.id === item.equipment_id);
          if (eq) {
            const labelCode = `EQPT:${eq.id}`;
            const qrDataUrl = await QRCode.toDataURL(labelCode, { errorCorrectionLevel: 'H', margin: 2, width: 256 });
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
        } else if (item.consumable_id) {
          const con = cons.find(c => c.id === item.consumable_id);
          if (con) {
            const labelCode = `CONS:${con.id}`;
            const qrDataUrl = await QRCode.toDataURL(labelCode, { errorCorrectionLevel: 'H', margin: 2, width: 256 });
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
      }

      if (labels.length === 0) {
        alert('No scannable label items found in this delivery.');
        return;
      }

      setPrintLabelsList(labels);
      setPrintModalOpen(true);
    } catch (err) {
      console.error('Failed to generate delivery labels:', err);
      alert('Failed to generate QR labels');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // If in Print/Success state
  if (submittedGRN) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Success Header banner - hidden in print */}
        <div className="no-print bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-xs">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">GRN Stock Intake Logged Successfully</h2>
              <p className="text-xs text-emerald-700/90 mt-0.5">Inventory balances have been incremented automatically.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintDeliveryLabels}
              className="h-9 px-3 bg-navy hover:bg-navy/95 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print Labels for Delivery
            </button>
            <button
              onClick={handlePrint}
              className="h-9 px-3 bg-white text-navy border border-border hover:bg-background rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print GRN
            </button>
            <button
              onClick={() => router.push('/equipment')}
              className="h-9 px-3 bg-primary hover:bg-primary/95 text-white rounded text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        {/* GRN Printable Paper Sheet */}
        <div className="bg-white border border-border rounded-lg p-8 shadow-sm print:border-0 print:shadow-none print:p-0 space-y-8 print-container">
          <div className="flex items-start justify-between border-b border-border pb-6">
            <div>
              {/* Fallback Egypro text logo */}
              <div className="text-navy font-black text-xl uppercase tracking-wider">
                EGYPRO <span className="text-primary">UGANDA</span>
              </div>
              <p className="text-[10px] text-text-muted mt-1">Telecom Engineering & Logistics Depot</p>
              <p className="text-[10px] text-text-muted">Plot 45 Kampala Road, Kampala, Uganda</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Goods Received Note</span>
              <h1 className="text-lg font-mono font-bold text-navy mt-1">{submittedGRN.grn_number}</h1>
              <p className="text-xs text-text-muted mt-1">
                Date: {new Date(submittedGRN.received_at).toLocaleString('en-UG')}
              </p>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-6 text-xs bg-background p-4 rounded-lg border border-border print:bg-white print:border-border">
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-bold">Received By</span>
              <span className="font-semibold text-navy mt-0.5 block">{user?.full_name}</span>
              <span className="text-[10px] text-text-muted">{user?.role === 'cfo' ? 'CFO' : 'Warehouse Manager'}</span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-bold">Supplier Name</span>
              <span className="font-semibold text-text mt-0.5 block">{submittedGRN.supplier_name || 'Not Specified'}</span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-bold">Delivery Note / PO Ref</span>
              <span className="font-semibold text-text mt-0.5 block">{submittedGRN.delivery_note_ref || 'None'}</span>
            </div>
          </div>

          {/* Line items list */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">Received Items Summary</h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-background text-navy font-semibold uppercase tracking-wider text-[10px] print:bg-transparent">
                  <th className="p-3">#</th>
                  <th className="p-3">Item Code</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Unit Value</th>
                  <th className="p-3 text-right">Condition</th>
                  <th className="p-3 text-right">Total (UGX)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submittedItems.map((it, index) => {
                  const qty = parseFloat(it.quantity_received.toString());
                  const val = parseFloat(it.unit_value_ugx.toString());
                  return (
                    <tr key={it.id}>
                      <td className="p-3 text-text-muted">{index + 1}</td>
                      <td className="p-3 font-mono font-bold text-navy">{it.item_code}</td>
                      <td className="p-3 text-text font-medium">{it.item_name}</td>
                      <td className="p-3 text-center font-semibold">{qty}</td>
                      <td className="p-3 text-right">{val.toLocaleString()} UGX</td>
                      <td className="p-3 text-right">
                        <span className="capitalize font-bold text-[10px]">{it.condition_on_arrival}</span>
                      </td>
                      <td className="p-3 text-right font-semibold text-navy">
                        {(qty * val).toLocaleString()} UGX
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold text-navy text-xs bg-background/50">
                  <td colSpan={5} className="p-3 text-right">Grand Total:</td>
                  <td colSpan={2} className="p-3 text-right text-sm">
                    {submittedItems.reduce((sum, it) => sum + (parseFloat(it.quantity_received.toString()) * parseFloat(it.unit_value_ugx.toString())), 0).toLocaleString()} UGX
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes block if exists */}
          {submittedGRN.notes && (
            <div className="text-xs bg-background p-4 border border-border rounded-lg print:border-border">
              <span className="text-[10px] font-bold text-navy uppercase block mb-1">Receipt Notes</span>
              <p className="text-text-muted">{submittedGRN.notes}</p>
            </div>
          )}

          {/* Printable Signature Lines */}
          <div className="pt-12 grid grid-cols-2 gap-12 text-xs border-t border-border mt-12 print:border-t">
            <div>
              <p className="text-text-muted mb-8">Received By Office Signature:</p>
              <div className="border-b border-border w-48 mb-1" />
              <p className="font-semibold text-navy">{user?.full_name}</p>
              <p className="text-[10px] text-text-muted">{user?.role === 'cfo' ? 'CFO' : 'Warehouse Manager'}</p>
            </div>
            <div>
              <p className="text-text-muted mb-8">Supplier Representative Name &amp; Signature:</p>
              <div className="border-b border-border w-48 mb-1" />
              <p className="text-[10px] text-text-muted">Representative Sign &amp; Stamp</p>
            </div>
          </div>
        </div>

        {/* Print Preview Modal */}
        {printModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs print:hidden no-print">
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
                      <span className="font-bold text-[10px] text-slate-700 font-mono tracking-wider font-semibold">EGYPRO LOGISTICS</span>
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

        {/* Print styling injection */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            header, aside {
              display: none !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
            }
            ${printLabelsList.length > 0 ? `
              .print-container {
                display: none !important;
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
            ` : `
              .print-container {
                border: 0 !important;
                box-shadow: none !important;
                padding: 0 !important;
              }
            `}
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-8 w-8 hover:bg-surface rounded-full transition-colors flex items-center justify-center border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            Goods Received Note (GRN) Intake
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Standard intake path for equipment arrivals from suppliers. Automatically logs stock increments.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-32 bg-surface border border-border animate-pulse rounded-lg" />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Data Card */}
          <div className="bg-surface border border-border rounded-lg p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1 md:col-span-3 pb-2 border-b border-border flex items-center gap-2 text-navy font-bold text-xs uppercase tracking-wider">
              <Truck className="h-4 w-4 text-primary" /> Delivery Header details
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Supplier Name (Optional)
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Huawei Uganda"
                className="w-full h-10 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Delivery Note / PO Ref (Optional)
              </label>
              <input
                type="text"
                value={deliveryNoteRef}
                onChange={(e) => setDeliveryNoteRef(e.target.value)}
                placeholder="e.g. DN-90182"
                className="w-full h-10 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Date &amp; Time Received
              </label>
              <input
                type="datetime-local"
                required
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary"
              />
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-semibold text-text mb-1">
                General Receipt Notes (Optional)
              </label>
              <textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                rows={2}
                placeholder="Add loading, condition, or shipping agent details..."
                className="w-full p-2.5 border border-border rounded-md text-xs bg-background focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Editable Lines Grid */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
              <span className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-primary" /> Delivery Line Items
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="h-8 px-3 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded transition-colors flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Add Item Line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-background border-b border-border text-navy font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Type</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Item Name / Model</th>
                    <th className="p-4 w-24">Quantity</th>
                    <th className="p-4 w-36">Unit Value (UGX)</th>
                    <th className="p-4 w-36">Arrival Condition</th>
                    <th className="p-4 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-background/20">
                      <td className="p-4 w-32">
                        <select
                          value={line.item_type}
                          onChange={(e) => handleLineChange(line.id, 'item_type', e.target.value)}
                          className="h-9 w-full px-2 border border-border rounded-md bg-background focus:outline-none text-xs font-medium"
                        >
                          <option value="consumable">Consumable</option>
                          <option value="reusable">Reusable</option>
                        </select>
                      </td>

                      <td className="p-4 w-44">
                        <select
                          required
                          value={line.category_id}
                          onChange={(e) => handleLineChange(line.id, 'category_id', e.target.value)}
                          className="h-9 w-full px-2 border border-border rounded-md bg-background focus:outline-none text-xs"
                        >
                          <option value="" disabled>Select Category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-4">
                        <input
                          type="text"
                          required
                          value={line.name}
                          onChange={(e) => handleLineChange(line.id, 'name', e.target.value)}
                          placeholder="e.g. Cat6 LAN Cable, RF Analyzer"
                          className="h-9 w-full px-3 border border-border rounded-md bg-background focus:outline-none text-xs"
                        />
                      </td>

                      <td className="p-4">
                        <input
                          type="number"
                          required
                          min={1}
                          disabled={line.item_type === 'reusable'} // Reusable quantity is forced to 1 to enable discrete asset codes
                          value={line.quantity_received}
                          onChange={(e) => handleLineChange(line.id, 'quantity_received', parseInt(e.target.value) || 0)}
                          className="h-9 w-full px-3 border border-border rounded-md bg-background focus:outline-none text-xs text-center font-semibold disabled:opacity-50"
                        />
                      </td>

                      <td className="p-4">
                        <input
                          type="number"
                          required
                          min={0}
                          value={line.unit_value_ugx}
                          onChange={(e) => handleLineChange(line.id, 'unit_value_ugx', parseFloat(e.target.value) || 0)}
                          className="h-9 w-full px-3 border border-border rounded-md bg-background focus:outline-none text-xs text-right font-medium"
                        />
                      </td>

                      <td className="p-4">
                        <select
                          value={line.condition_on_arrival}
                          onChange={(e) => handleLineChange(line.id, 'condition_on_arrival', e.target.value)}
                          className="h-9 w-full px-2 border border-border rounded-md bg-background focus:outline-none text-xs"
                        >
                          <option value="good">Good Condition</option>
                          <option value="damaged">Damaged / Flawed</option>
                          <option value="pending_inspection">Pending Inspection</option>
                        </select>
                      </td>

                      <td className="p-4 text-right w-16">
                        <button
                          type="button"
                          disabled={lines.length === 1}
                          onClick={() => handleRemoveLine(line.id)}
                          className="h-9 w-9 border border-border rounded-md flex items-center justify-center text-text-muted hover:text-danger hover:border-danger/30 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Footer Banner */}
            <div className="p-4 border-t border-border bg-background/50 flex flex-col md:flex-row md:items-center md:justify-between text-xs gap-3">
              <span className="text-text-muted font-medium">
                {lines.length} lines logged · Reusable items are received as distinct individual asset records.
              </span>
              <div className="text-navy font-bold text-sm bg-background border border-border px-4 py-2 rounded-lg">
                Total Value: <span className="text-primary font-black">{calculateSubtotal().toLocaleString()} UGX</span>
              </div>
            </div>
          </div>

          {/* Submission button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="h-11 px-6 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Generating GRN...' : 'Receive Stock & Generate GRN'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
