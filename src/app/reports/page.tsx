"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, Equipment, ConsumableStock, Transaction, DamageReport, ReportExport, Category, User } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Calendar, 
  Coins, 
  TrendingUp, 
  CheckCircle,
  HelpCircle,
  FileDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exportsList, setExportsList] = useState<ReportExport[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Stats summary
  const [totalValuation, setTotalValuation] = useState(0);
  const [monthlyMovements, setMonthlyMovements] = useState(0);
  const [repairCosts, setRepairCosts] = useState(0);

  // Form State
  const [reportType, setReportType] = useState<'inventory_valuation' | 'stock_movements' | 'damage_costs' | 'full_audit'>('inventory_valuation');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('excel');

  // Load active month date range defaults
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setDateFrom(firstDay.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const cats = await db.getCategories();
      setCategories(cats);

      // Load past exports
      const list = await db.getReportExports();
      setExportsList(list.slice(0, 10)); // display last 10 exports

      // Calculate Summary stats
      const eqs = await db.getEquipment();
      const cons = await db.getConsumables();
      const txs = await db.getTransactions();
      const drs = await db.getDamageReports();

      // Total Valuation (all assets)
      const eqVal = eqs.reduce((sum, item) => sum + (item.status !== 'retired' ? Number(item.unit_value_ugx || 0) : 0), 0);
      const conVal = cons.reduce((sum, item) => sum + (Number(item.unit_value_ugx || 0) * Number(item.quantity_on_hand || 0)), 0);
      setTotalValuation(eqVal + conVal);

      // Monthly Movements (transactions in past 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentTxs = txs.filter(tx => new Date(tx.created_at) >= thirtyDaysAgo);
      setMonthlyMovements(recentTxs.length);

      // Total repair costs
      const activeRepairsCost = drs.reduce((sum, dr) => sum + Number(dr.actual_repair_cost_ugx || dr.estimated_repair_cost_ugx || 0), 0);
      setRepairCosts(activeRepairsCost);

    } catch (err) {
      console.error('Error fetching reports summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'cfo') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user]);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setGenerating(true);
    try {
      // Gather relevant catalog dataset
      const eqs = await db.getEquipment();
      const cons = await db.getConsumables();
      const txs = await db.getTransactions();
      const drs = await db.getDamageReports();

      let reportData: any[] = [];
      let filename = `Report_${reportType}_${dateFrom}_to_${dateTo}`;
      let title = '';

      const filterByDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= new Date(dateFrom) && d <= new Date(dateTo + 'T23:59:59');
      };

      if (reportType === 'inventory_valuation') {
        title = 'Inventory Asset Valuation Report';
        
        // Map equipment
        eqs.forEach(eq => {
          const cat = categories.find(c => c.id === eq.category_id);
          reportData.push({
            'Asset/SKU Code': eq.asset_code,
            'Item Name': eq.name,
            'Category': cat ? cat.name : 'Equipment',
            'Status': eq.status.toUpperCase(),
            'Unit Value (UGX)': eq.unit_value_ugx,
            'Acquisition Date': new Date(eq.created_at).toLocaleDateString(),
            'Current Location': eq.current_location || 'Kampala Central Warehouse'
          });
        });

        // Map consumables
        cons.forEach(con => {
          const cat = categories.find(c => c.id === con.category_id);
          reportData.push({
            'Asset/SKU Code': con.sku_code,
            'Item Name': con.name,
            'Category': cat ? cat.name : 'Consumables',
            'Status': con.quantity_on_hand > con.reorder_level ? 'IN STOCK' : 'LOW STOCK',
            'Unit Value (UGX)': con.unit_value_ugx,
            'Acquisition Date': new Date(con.created_at).toLocaleDateString(),
            'Current Location': `Depot (${con.quantity_on_hand} Units Available)`
          });
        });
      } 
      else if (reportType === 'stock_movements') {
        title = 'Stock Movements & Transaction Audit Report';
        const filteredTxs = txs.filter(tx => filterByDate(tx.created_at));
        
        filteredTxs.forEach(tx => {
          reportData.push({
            'Date & Time': new Date(tx.created_at).toLocaleString(),
            'Transaction Type': tx.transaction_type.toUpperCase().replace(/_/g, ' '),
            'Item Name': tx.item_name || 'Generic SKU',
            'Code': tx.asset_or_sku_code || '—',
            'Quantity': tx.quantity,
            'Performed By': tx.performed_by_name || 'System Operator',
            'Counterparty': tx.counterparty_name || 'Field PM',
            'Notes': tx.notes || '—',
            'Entry Method': (tx.entry_method || 'manual').toUpperCase()
          });
        });
      } 
      else if (reportType === 'damage_costs') {
        title = 'Asset Damage and Repair Cost Reconciliation';
        const filteredDrs = drs.filter(dr => filterByDate(dr.reported_at));

        filteredDrs.forEach(dr => {
          reportData.push({
            'Report ID': dr.id.split('_')[1] || dr.id,
            'Asset Code': dr.equipment_asset_code || '—',
            'Item Name': dr.equipment_name || 'Equipment',
            'Condition': dr.status.toUpperCase(),
            'Reported Date': new Date(dr.reported_at).toLocaleDateString(),
            'Est. Cost (UGX)': dr.estimated_repair_cost_ugx || 0,
            'Actual Cost (UGX)': dr.actual_repair_cost_ugx || 0,
            'Vendor Name': dr.vendor_name || 'Not Assigned',
            'Resolved Date': dr.resolved_at ? new Date(dr.resolved_at).toLocaleDateString() : 'Active Under Repair'
          });
        });
      }
      else if (reportType === 'full_audit') {
        title = 'Egypro Logistics Full System Audit Log';
        
        // Add transactions
        txs.filter(tx => filterByDate(tx.created_at)).forEach(tx => {
          reportData.push({
            'Timestamp': new Date(tx.created_at).toLocaleString(),
            'Event Source': 'TRANSACTION LOG',
            'Event Code': tx.asset_or_sku_code || 'System log',
            'Event Action': tx.transaction_type.toUpperCase(),
            'Summary': tx.notes || `Log item transaction of ${tx.quantity} units`,
            'User': tx.performed_by_name || 'Depot Manager'
          });
        });

        // Add damage logs
        drs.filter(dr => filterByDate(dr.reported_at)).forEach(dr => {
          reportData.push({
            'Timestamp': new Date(dr.reported_at).toLocaleString(),
            'Event Source': 'DAMAGE REPAIR LOG',
            'Event Code': dr.equipment_asset_code || 'Repair log',
            'Event Action': `DAMAGE REPORTED: ${dr.status.toUpperCase()}`,
            'Summary': dr.damage_description,
            'User': dr.reported_by_name || 'WM Inspector'
          });
        });

        // Sort full audit by timestamp desc
        reportData.sort((a, b) => new Date(b['Timestamp']).getTime() - new Date(a['Timestamp']).getTime());
      }

      if (reportData.length === 0) {
        alert('No data records found in specified date ranges to generate a report.');
        setGenerating(false);
        return;
      }

      let generatedBlob: Blob;
      let mimeType = '';

      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Log Sheet');
        
        // Generate binary buffer array
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        generatedBlob = new Blob([excelBuffer], { type: mimeType });
        
        // Trigger immediate browser local download for direct access
        XLSX.writeFile(wb, `${filename}.xlsx`);
      } else {
        // PDF compilation via jsPDF
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(11, 28, 62); // Navy title
        doc.text('EGYPRO UGANDA LOGISTICS COMMAND', 14, 15);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(110, 110, 110);
        doc.text(`${title} · Date range: ${dateFrom} to ${dateTo}`, 14, 21);

        const columns = Object.keys(reportData[0]);
        const rows = reportData.map(row => columns.map(col => row[col]));

        (doc as any).autoTable({
          head: [columns],
          body: rows,
          startY: 26,
          theme: 'striped',
          headStyles: { fillColor: [11, 28, 62], textColor: [255, 255, 255] },
          styles: { fontSize: 8, font: 'Helvetica' }
        });

        mimeType = 'application/pdf';
        const pdfOutput = doc.output('blob');
        generatedBlob = pdfOutput;

        // Trigger local browser download
        doc.save(`${filename}.pdf`);
      }

      // Upload output file blob URL
      const file_url = URL.createObjectURL(generatedBlob);

      // Create new export row link
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + 7); // expires in 7 days

      await db.createReportExport({
        company_id: user.company_id,
        report_type: reportType,
        generated_by: user.id,
        date_from: dateFrom,
        date_to: dateTo,
        format,
        file_url,
        expires_at: expires_at.toISOString()
      });

      await fetchData(); // refresh list
    } catch (err: any) {
      console.error('Report compilation failed:', err);
      alert('Failed to generate report export');
    } finally {
      setGenerating(false);
    }
  };

  const getReportLabel = (type: string) => {
    switch (type) {
      case 'inventory_valuation': return 'Inventory Valuation';
      case 'stock_movements': return 'Stock Movements';
      case 'damage_costs': return 'Damage & Repair Costs';
      case 'full_audit': return 'Full System Audit';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-navy">Corporate Performance & Audit Reports</h2>
        <p className="text-sm text-text-muted">Export certified stock balances, valuations, and logistics transactions</p>
      </div>

      {/* Aggregate Stats Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border p-5 rounded-xl shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Coins size={22} />
          </div>
          <div>
            <div className="text-xl font-bold text-navy">
              {totalValuation.toLocaleString()} UGX
            </div>
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mt-0.5">Asset Valuation</div>
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="text-xl font-bold text-navy">
              {monthlyMovements} transactions
            </div>
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mt-0.5">Movements (30 Days)</div>
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="text-xl font-bold text-navy">
              {repairCosts.toLocaleString()} UGX
            </div>
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mt-0.5">Repair Liabilities</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Generate Report Card Panel */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs lg:col-span-1">
          <h3 className="text-sm font-bold text-navy border-b border-border pb-3 mb-4 flex items-center gap-1.5">
            <FileSpreadsheet size={16} className="text-primary" />
            <span>Generate New Export</span>
          </h3>

          <form onSubmit={handleGenerateReport} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Report Type *
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full h-10 px-3 border border-border bg-background rounded-md text-xs text-text focus:outline-none focus:border-primary"
              >
                <option value="inventory_valuation">Inventory Asset Valuation</option>
                <option value="stock_movements">Stock Movements & Transactions</option>
                <option value="damage_costs">Damage & Repair Expenses</option>
                <option value="full_audit">Full Activity System Audit</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  From Date *
                </label>
                <input
                  type="date"
                  required
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-10 px-3 border border-border bg-background rounded-md text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  To Date *
                </label>
                <input
                  type="date"
                  required
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-10 px-3 border border-border bg-background rounded-md text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Export Format *
              </label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setFormat('excel')}
                  className={`h-10 border rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all focus:outline-none ${
                    format === 'excel' 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border bg-background text-text-muted hover:bg-background/80'
                  }`}
                >
                  <FileSpreadsheet size={14} />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('pdf')}
                  className={`h-10 border rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all focus:outline-none ${
                    format === 'pdf' 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border bg-background text-text-muted hover:bg-background/80'
                  }`}
                >
                  <FileText size={14} />
                  <span>PDF Document</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={generating}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 mt-2 focus:outline-none"
            >
              {generating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Compiling Ledger Data...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Compile and Export</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Recent Exports History Table List */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs lg:col-span-2">
          <h3 className="text-sm font-bold text-navy border-b border-border pb-3 mb-4 flex items-center gap-1.5">
            <FileDown size={16} className="text-primary" />
            <span>Recent Exports Log (Last 10)</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-background text-text-muted font-semibold uppercase border-b border-border">
                  <th className="px-4 py-3">Report Details</th>
                  <th className="px-4 py-3">Date Range</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Generated At</th>
                  <th className="px-4 py-3">Expires At</th>
                  <th className="px-4 py-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      <span className="text-[10px] text-text-muted mt-2 block">Loading audit logs...</span>
                    </td>
                  </tr>
                ) : exportsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-text-muted italic">
                      No reports generated yet for this billing cycle.
                    </td>
                  </tr>
                ) : (
                  exportsList.map(item => {
                    const isExpired = new Date(item.expires_at) < new Date();
                    return (
                      <tr key={item.id} className="hover:bg-background/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-navy">{getReportLabel(item.report_type)}</div>
                          <div className="text-[9px] text-text-muted">By: {item.generated_by_name}</div>
                        </td>
                        <td className="px-4 py-3 text-text-muted font-mono">
                          {item.date_from} to {item.date_to}
                        </td>
                        <td className="px-4 py-3 uppercase">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            item.format === 'excel' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
                          }`}>
                            {item.format}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {new Date(item.generated_at).toLocaleString('en-UG')}
                        </td>
                        <td className="px-4 py-3">
                          {isExpired ? (
                            <span className="text-rose-500 font-semibold flex items-center gap-0.5">
                              <AlertTriangle size={10} />
                              Expired
                            </span>
                          ) : (
                            <span className="text-text-muted">
                              {new Date(item.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isExpired ? (
                            <button
                              onClick={() => {
                                setReportType(item.report_type);
                                setDateFrom(item.date_from);
                                setDateTo(item.date_to);
                                setFormat(item.format);
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-background border border-border text-[10px] font-bold text-navy hover:bg-navy/5 rounded transition-all focus:outline-none"
                              title="Re-generate report"
                            >
                              <RefreshCw size={10} />
                              <span>Re-generate</span>
                            </button>
                          ) : (
                            <a
                              href={item.file_url}
                              download={`Report_${item.report_type}_${item.date_from}_to_${item.date_to}.${item.format === 'excel' ? 'xlsx' : 'pdf'}`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary hover:bg-primary/20 rounded transition-all focus:outline-none"
                              title="Download copy"
                            >
                              <Download size={10} />
                              <span>Download</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple loader helper
function Loader2({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
