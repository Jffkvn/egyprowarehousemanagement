"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Calendar, 
  MapPin, 
  User, 
  Info,
  Package,
  Wrench,
  Check,
  AlertCircle
} from 'lucide-react';
import { db, Equipment, ConsumableStock, Request, QrLabel } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';

interface ScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

export default function ScannerOverlay({ isOpen, onClose, onActionComplete }: ScannerOverlayProps) {
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [scannerError, setScannerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Scanned item states
  const [scannedCode, setScannedCode] = useState<string>('');
  const [scannedItem, setScannedItem] = useState<{
    id: string;
    type: 'reusable' | 'consumable';
    name: string;
    code: string;
    status?: string;
    quantity_on_hand?: number;
    location?: string;
    category_id: string;
  } | null>(null);

  // Checkout states
  const [matchingRequests, setMatchingRequests] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string>('');

  // Return states
  const [returnCondition, setReturnCondition] = useState<'good' | 'damaged' | 'missing_parts' | 'non_functional'>('good');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Status logs
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string>('');
  const [scanErrorMessage, setScanErrorMessage] = useState<string>('');

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const startScanner = async () => {
    setScannedItem(null);
    setScannedCode('');
    setMatchingRequests([]);
    setSelectedRequest('');
    setReturnCondition('good');
    setReturnNotes('');
    setScanSuccessMessage('');
    setScanErrorMessage('');
    setScannerError(null);

    // Wait a brief tick for DOM rendering of viewport element
    setTimeout(async () => {
      const viewport = document.getElementById('qr-reader-viewport');
      if (!viewport) return;

      try {
        const html5Qrcode = new Html5Qrcode('qr-reader-viewport');
        scannerRef.current = html5Qrcode;
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.65;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            handleCodeScanned(decodedText);
          },
          (errorMessage) => {
            // ignore frame parsing errors
          }
        );
      } catch (err: any) {
        console.error('Failed to start scanner:', err);
        setScannerError('Could not access camera. Please verify device permissions.');
      }
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const handleCodeScanned = async (decodedText: string) => {
    // Pause scanner upon successful decode
    await stopScanner();
    setScannedCode(decodedText);
    setLoading(true);
    setScanErrorMessage('');
    setScanSuccessMessage('');

    try {
      // Parse QR label code format
      const parts = decodedText.split(':');
      if (parts.length < 2) {
        throw new Error('Invalid code format');
      }

      const prefix = parts[0];
      const itemId = parts[1];

      if (prefix === 'EQPT') {
        const eqs = await db.getEquipment();
        const eq = eqs.find(e => e.id === itemId);
        if (!eq) {
          throw new Error('Equipment item not found in catalog');
        }

        setScannedItem({
          id: eq.id,
          type: 'reusable',
          name: eq.name,
          code: eq.asset_code,
          status: eq.status,
          location: eq.current_location,
          category_id: eq.category_id
        });

        // If available, fetch approved requests containing this item
        if (eq.status === 'available') {
          const reqs = await db.getRequests();
          const matches = reqs.filter(r => 
            r.status === 'approved' && 
            r.items?.some(ri => ri.equipment_id === eq.id)
          );
          setMatchingRequests(matches);
          if (matches.length === 1) {
            setSelectedRequest(matches[0].id);
          }
        }
      } else if (prefix === 'CONS') {
        const cons = await db.getConsumables();
        const con = cons.find(c => c.id === itemId);
        if (!con) {
          throw new Error('Consumable SKU not found in inventory');
        }

        setScannedItem({
          id: con.id,
          type: 'consumable',
          name: con.name,
          code: con.sku_code,
          quantity_on_hand: con.quantity_on_hand,
          category_id: con.category_id
        });

        // Fetch approved requests containing this SKU
        const reqs = await db.getRequests();
        const matches = reqs.filter(r => 
          r.status === 'approved' && 
          r.items?.some(ri => ri.consumable_id === con.id)
        );
        setMatchingRequests(matches);
        if (matches.length === 1) {
          setSelectedRequest(matches[0].id);
        }
      } else {
        throw new Error('Unrecognized Egyptpro QR prefix');
      }
    } catch (err: any) {
      console.error('Scan handling failed:', err);
      setScanErrorMessage(err.message || 'QR code not recognized. Outdated label.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedItem || !selectedRequest || !user) return;
    
    setSubmitting(true);
    try {
      await db.checkoutRequest(selectedRequest, user.id, 'qr_scan');
      setScanSuccessMessage(`Successfully checked out ${scannedItem.name} (${scannedItem.code})`);
      if (onActionComplete) onActionComplete();
      
      // Auto-reset state for next scan after brief toast display
      setTimeout(() => {
        startScanner();
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Handout logging failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedItem || !user) return;
    
    setSubmitting(true);
    try {
      // We need to look up which request this equipment is checked out to.
      // In mock/real database, find the latest 'checkout' transaction for this equipment that hasn't been returned,
      // or search requests with status 'fulfilled' that contain this equipment_id.
      const reqs = await db.getRequests();
      const fulfilledRequest = reqs.find(r => 
        r.status === 'fulfilled' && 
        r.items?.some(ri => ri.equipment_id === scannedItem.id)
      );

      if (!fulfilledRequest) {
        throw new Error('No active fulfilled project checkout found for this equipment.');
      }

      await db.returnRequestItem(
        fulfilledRequest.id, 
        scannedItem.id, 
        returnCondition, 
        returnNotes, 
        user.id, 
        'qr_scan'
      );

      setScanSuccessMessage(`Successfully returned ${scannedItem.name} (${scannedItem.code})`);
      if (onActionComplete) onActionComplete();

      setTimeout(() => {
        startScanner();
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Return logging failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-navy/95 backdrop-blur-md flex flex-col items-center justify-between p-6 text-white overflow-y-auto">
      
      {/* Top Header Bar */}
      <div className="w-full max-w-md flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
            <Camera size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Egypro Scanner</h3>
            <p className="text-[10px] text-text-muted">Rear camera active</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Viewport Card */}
      <div className="w-full max-w-md my-auto flex flex-col items-center justify-center space-y-6">
        
        {/* Camera container */}
        <div className="relative w-full aspect-square max-w-[340px] bg-black border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          
          <div id="qr-reader-viewport" className="absolute inset-0 w-full h-full" />

          {/* Green targeting reticle overlay */}
          {!scannedItem && !scanSuccessMessage && !scanErrorMessage && !scannerError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-[200px] h-[200px] border-2 border-emerald-500 rounded-2xl relative animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
              </div>
            </div>
          )}
          
          {/* Status Spinners */}
          {loading && (
            <div className="absolute inset-0 bg-navy/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 z-20">
              <Loader2 size={36} className="text-primary animate-spin" />
              <span className="text-xs text-text-muted">Fetching catalog data...</span>
            </div>
          )}
        </div>

        {/* Scan Status Alerts */}
        <div className="w-full text-center">
          {scanSuccessMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center justify-center space-x-2 text-xs font-semibold animate-scale-up">
              <CheckCircle2 size={16} />
              <span>{scanSuccessMessage}</span>
            </div>
          )}

          {scanErrorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex flex-col items-center space-y-2 text-xs animate-scale-up">
              <div className="flex items-center space-x-1.5 font-semibold">
                <AlertTriangle size={16} />
                <span>{scanErrorMessage}</span>
              </div>
              <button 
                onClick={startScanner}
                className="mt-2 text-[10px] font-bold text-white hover:underline uppercase"
              >
                Tap to Scan Again
              </button>
            </div>
          )}

          {scannerError && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl flex flex-col items-center space-y-2 text-xs">
              <AlertCircle size={20} />
              <span className="font-semibold">{scannerError}</span>
              <p className="text-[10px] text-white/60">Check browser security permissions for camera device access.</p>
            </div>
          )}

          {!scannedItem && !scanSuccessMessage && !scanErrorMessage && !scannerError && (
            <p className="text-xs text-white/50">Align the QR label code inside the frame to scan automatically.</p>
          )}
        </div>

        {/* Result Form Cards */}
        {scannedItem && !scanSuccessMessage && (
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 animate-slide-up text-left">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">{scannedItem.name}</h4>
                <span className="text-[10px] font-mono text-white/50">{scannedItem.code}</span>
              </div>
              {scannedItem.type === 'reusable' ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                  scannedItem.status === 'available' ? 'bg-emerald-500/20 text-emerald-400' :
                  scannedItem.status === 'checked_out' ? 'bg-amber-500/20 text-amber-400' :
                  scannedItem.status === 'overdue' ? 'bg-rose-500/20 text-rose-400' :
                  'bg-white/10 text-white/60'
                }`}>
                  {scannedItem.status}
                </span>
              ) : (
                <span className="bg-blue-500/20 text-blue-400 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase">
                  Consumable ({scannedItem.quantity_on_hand} Units)
                </span>
              )}
            </div>

            {/* Context Actions */}
            {scannedItem.type === 'reusable' && (scannedItem.status === 'checked_out' || scannedItem.status === 'overdue') ? (
              // Return Flow
              <form onSubmit={handleReturnSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wide mb-1">
                    Return Condition *
                  </label>
                  <select 
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value as any)}
                    className="w-full h-10 px-3 bg-navy border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="good">Good Condition</option>
                    <option value="damaged">Damaged (Triggers repair report)</option>
                    <option value="missing_parts">Missing Parts</option>
                    <option value="non_functional">Non Functional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wide mb-1">
                    Return Notes
                  </label>
                  <textarea 
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Describe condition details, field observations..."
                    rows={2}
                    className="w-full p-3 bg-navy border border-white/15 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex space-x-3 pt-2">
                  <button 
                    type="button"
                    onClick={startScanner}
                    className="w-1/2 h-10 border border-white/15 rounded-lg text-xs font-semibold hover:bg-white/5 transition-colors"
                  >
                    Cancel Scan
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-1/2 h-10 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Log Return'}
                  </button>
                </div>
              </form>
            ) : scannedItem.status === 'under_repair' ? (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg text-xs text-amber-400 flex items-start space-x-2">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <p>This equipment is currently marked <strong>Under Repair</strong>. Inspect repairs inside the active damage reports catalog before handing out.</p>
                </div>
                <button 
                  onClick={startScanner}
                  className="w-full h-10 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  Rescan Next Item
                </button>
              </div>
            ) : scannedItem.status === 'retired' ? (
              <div className="space-y-4">
                <div className="bg-rose-500/10 border border-rose-500/25 p-3 rounded-lg text-xs text-rose-400 flex items-start space-x-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <p>This equipment unit has been officially <strong>Retired</strong> and cannot be handed out or checked in.</p>
                </div>
                <button 
                  onClick={startScanner}
                  className="w-full h-10 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  Rescan Next Item
                </button>
              </div>
            ) : (
              // Checkout Flow (for available reusable or any consumable)
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wide mb-1">
                    Link Approved Request *
                  </label>
                  {matchingRequests.length === 0 ? (
                    <div className="bg-rose-500/10 border border-rose-500/25 p-3 rounded-lg text-xs text-rose-400 flex items-start space-x-2">
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <p>No active approved requests found for this item. Active handouts must be pre-authorized.</p>
                    </div>
                  ) : (
                    <select 
                      value={selectedRequest}
                      onChange={(e) => setSelectedRequest(e.target.value)}
                      className="w-full h-10 px-3 bg-navy border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Choose request authorization --</option>
                      {matchingRequests.map(r => (
                        <option key={r.id} value={r.id}>
                          Project: {r.project_name} (PM: {r.requested_by_name || 'Field PM'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                
                {selectedRequest && (
                  <div className="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-lg text-xs text-emerald-400 flex items-start space-x-2">
                    <Info size={14} className="mt-0.5 flex-shrink-0" />
                    <p>Handout will be authorized and logged under project <strong>{matchingRequests.find(r => r.id === selectedRequest)?.project_name}</strong>.</p>
                  </div>
                )}

                <div className="flex space-x-3 pt-2">
                  <button 
                    type="button"
                    onClick={startScanner}
                    className="w-1/2 h-10 border border-white/15 rounded-lg text-xs font-semibold hover:bg-white/5 transition-colors"
                  >
                    Cancel Scan
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting || !selectedRequest}
                    className="w-1/2 h-10 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Confirm Checkout'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="w-full max-w-md text-center border-t border-white/10 pt-4 flex items-center justify-between text-[10px] text-white/40">
        <span>Powered by Egypro Uganda Logistics</span>
        <span>Secure HTTPS Connection</span>
      </div>

    </div>
  );
}
