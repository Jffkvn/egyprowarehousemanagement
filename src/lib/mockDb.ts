// Mock Database Implementation for Egypro EquipTrack (Phase One)
// Saves state to localStorage for local running/development without Supabase.

export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  role: 'pm' | 'warehouse_manager' | 'cfo';
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Settings {
  id: string;
  company_id: string;
  approval_threshold_ugx: number;
  updated_at: string;
  updated_by?: string;
}

export interface Category {
  id: string;
  company_id: string;
  name: string;
  code_prefix: string;
  item_type: 'reusable' | 'consumable';
}

export interface Equipment {
  id: string;
  company_id: string;
  category_id: string;
  name: string;
  asset_code: string;
  manufacturer_serial?: string;
  unit_value_ugx: number;
  status: 'available' | 'checked_out' | 'overdue' | 'under_repair' | 'retired' | 'pending_inspection';
  condition_notes?: string;
  current_location?: string;
  damage_report_id?: string;
  qr_label_id?: string;
  created_at: string;
  created_by?: string;
}

export interface ConsumableStock {
  id: string;
  company_id: string;
  category_id: string;
  name: string;
  sku_code: string;
  unit_value_ugx: number;
  quantity_on_hand: number;
  reorder_level: number;
  qr_label_id?: string;
  created_at: string;
  created_by?: string;
}

export interface RequestItem {
  id: string;
  request_id: string;
  equipment_id?: string;
  consumable_id?: string;
  quantity_requested: number;
  // UI helpers
  name?: string;
  item_type?: 'reusable' | 'consumable';
  unit_value_ugx?: number;
  asset_code?: string;
  sku_code?: string;
}

export interface Request {
  id: string;
  company_id: string;
  requested_by: string;
  project_name: string;
  site_location?: string;
  needed_from: string;
  needed_until?: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'returned' | 'cancelled';
  routed_to: 'warehouse_manager' | 'cfo';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  // UI helpers
  requested_by_name?: string;
  items?: RequestItem[];
}

export interface Transaction {
  id: string;
  company_id: string;
  transaction_type: 'checkout' | 'return' | 'stock_added' | 'stock_consumed' | 'retired' | 'sent_for_repair' | 'returned_from_repair';
  equipment_id?: string;
  consumable_id?: string;
  request_id?: string;
  quantity: number;
  performed_by: string;
  counterparty?: string;
  condition_at_event?: 'good' | 'damaged' | 'missing_parts' | 'non_functional';
  notes?: string;
  entry_method: 'manual' | 'grn' | 'qr_scan';
  created_at: string;
  // UI helpers
  performed_by_name?: string;
  counterparty_name?: string;
  item_name?: string;
  asset_or_sku_code?: string;
}

export interface ProcurementRequest {
  id: string;
  company_id: string;
  category_id: string;
  description: string;
  estimated_cost_ugx: number;
  quantity: number;
  status: 'requested' | 'ordered' | 'received';
  created_by: string;
  created_at: string;
  // UI helper
  category_name?: string;
  created_by_name?: string;
}

export interface Notification {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  push_sent?: boolean;
  push_sent_at?: string;
  created_at: string;
}

export interface DamageReport {
  id: string;
  company_id: string;
  equipment_id: string;
  originating_transaction_id?: string;
  reported_by: string;
  reported_at: string;
  damage_description: string;
  estimated_repair_cost_ugx?: number;
  actual_repair_cost_ugx?: number;
  vendor_name?: string;
  status: 'open' | 'under_repair' | 'resolved' | 'written_off';
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  photos?: string[];
  created_at: string;
  // UI helpers
  equipment_name?: string;
  equipment_asset_code?: string;
  reported_by_name?: string;
  resolved_by_name?: string;
}

export interface GrnDocument {
  id: string;
  company_id: string;
  grn_number: string;
  received_by: string;
  supplier_name?: string;
  delivery_note_ref?: string;
  received_at: string;
  notes?: string;
  created_at: string;
  // UI helper
  received_by_name?: string;
  items_count?: number;
  total_value?: number;
}

export interface GrnItem {
  id: string;
  grn_id: string;
  equipment_id?: string;
  consumable_id?: string;
  quantity_received: number;
  unit_value_ugx: number;
  condition_on_arrival: 'good' | 'damaged' | 'pending_inspection';
  notes?: string;
  // UI helper
  item_name?: string;
  item_code?: string;
}

export interface NotificationChannel {
  id: string;
  user_id: string;
  whatsapp_number?: string;
  email_enabled: boolean;
  preferred_channel: 'whatsapp' | 'email' | 'both' | 'in_app_only';
  is_active: boolean;
  updated_at: string;
}

export interface QrLabel {
  id: string;
  company_id: string;
  equipment_id?: string;
  consumable_id?: string;
  label_code: string;
  generated_at: string;
  generated_by?: string;
  printed_at?: string;
}

export interface ReportExport {
  id: string;
  company_id: string;
  report_type: 'inventory_valuation' | 'stock_movements' | 'damage_costs' | 'full_audit';
  generated_by: string;
  date_from: string;
  date_to: string;
  format: 'pdf' | 'excel';
  file_url: string;
  generated_at: string;
  expires_at: string;
  // UI helpers
  generated_by_name?: string;
}

export interface CashAdvance {
  id: string;
  company_id: string;
  requested_by: string;
  project_name: string;
  purpose: string;
  amount_requested_ugx: number;
  expected_retirement_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed' | 'partially_retired' | 'retired' | 'overdue';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  // UI helpers
  requested_by_name?: string;
  outstanding_ugx?: number;
  amount_disbursed_ugx?: number;
  amount_retired_ugx?: number;
}

export interface Disbursement {
  id: string;
  company_id: string;
  advance_id: string;
  method: 'bank_transfer' | 'cash';
  amount_ugx: number;
  bank_reference?: string;
  bank_account?: string;
  witness_name?: string;
  signed_proof_url?: string;
  disbursed_by: string;
  disbursed_at: string;
  created_at: string;
}

export interface RetirementEntry {
  id: string;
  company_id: string;
  advance_id: string;
  submitted_by: string;
  category: 'fuel' | 'allowances' | 'materials' | 'accommodation' | 'other';
  description: string;
  amount_ugx: number;
  receipt_photo_url: string;
  entry_date: string;
  created_at: string;
}

// Initial Mock Seed Data
const MOCK_COMPANY_ID = 'c1c1c1c1-1111-1111-1111-111111111111';
const MOCK_USERS: User[] = [
  {
    id: 'u1111111-1111-1111-1111-111111111111',
    company_id: MOCK_COMPANY_ID,
    full_name: 'John CFO',
    email: 'cfo@egypro.com',
    role: 'cfo',
    phone: '+256 701 123456',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'u2222222-2222-2222-2222-222222222222',
    company_id: MOCK_COMPANY_ID,
    full_name: 'David Warehouse',
    email: 'wm@egypro.com',
    role: 'warehouse_manager',
    phone: '+256 702 123456',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'u3333333-3333-3333-3333-333333333333',
    company_id: MOCK_COMPANY_ID,
    full_name: 'Sarah Project Manager',
    email: 'pm@egypro.com',
    role: 'pm',
    phone: '+256 703 123456',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

const MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat11111-1111-1111-1111-111111111111',
    company_id: MOCK_COMPANY_ID,
    name: 'Generators',
    code_prefix: 'GEN',
    item_type: 'reusable'
  },
  {
    id: 'cat22222-2222-2222-2222-222222222222',
    company_id: MOCK_COMPANY_ID,
    name: 'Tower Tools',
    code_prefix: 'TWR',
    item_type: 'reusable'
  },
  {
    id: 'cat33333-3333-3333-3333-333333333333',
    company_id: MOCK_COMPANY_ID,
    name: 'Cabling',
    code_prefix: 'CAB',
    item_type: 'consumable'
  }
];

const MOCK_EQUIPMENT: Equipment[] = [
  {
    id: 'eq111111-1111-1111-1111-111111111111',
    company_id: MOCK_COMPANY_ID,
    category_id: 'cat11111-1111-1111-1111-111111111111',
    name: 'Honda EU22i Generator',
    asset_code: 'GEN-0001',
    manufacturer_serial: 'HN-2210492',
    unit_value_ugx: 1200000,
    status: 'available',
    condition_notes: 'Excellent condition, fully fueled.',
    current_location: 'Kampala Central Warehouse',
    created_at: new Date().toISOString(),
    created_by: 'u1111111-1111-1111-1111-111111111111'
  },
  {
    id: 'eq222222-2222-2222-2222-222222222222',
    company_id: MOCK_COMPANY_ID,
    category_id: 'cat11111-1111-1111-1111-111111111111',
    name: 'Yamaha EF2000iS Generator',
    asset_code: 'GEN-0002',
    manufacturer_serial: 'YM-928401',
    unit_value_ugx: 950000,
    status: 'available',
    condition_notes: 'Slight cosmetic scratches, runs perfectly.',
    current_location: 'Kampala Central Warehouse',
    created_at: new Date().toISOString(),
    created_by: 'u1111111-1111-1111-1111-111111111111'
  },
  {
    id: 'eq333333-3333-3333-3333-333333333333',
    company_id: MOCK_COMPANY_ID,
    category_id: 'cat22222-2222-2222-2222-222222222222',
    name: 'Harness & Lanyard Set',
    asset_code: 'TWR-0001',
    manufacturer_serial: 'SN-HARN-01',
    unit_value_ugx: 350000,
    status: 'available',
    condition_notes: 'Safety inspection passed June 2026.',
    current_location: 'Kampala Central Warehouse',
    created_at: new Date().toISOString(),
    created_by: 'u2222222-2222-2222-2222-222222222222'
  },
  {
    id: 'eq444444-4444-4444-4444-444444444444',
    company_id: MOCK_COMPANY_ID,
    category_id: 'cat22222-2222-2222-2222-222222222222',
    name: 'Heavy Duty Tensioner',
    asset_code: 'TWR-0002',
    manufacturer_serial: 'SN-TENS-99',
    unit_value_ugx: 600000,
    status: 'available',
    condition_notes: 'Well greased.',
    current_location: 'Kampala Central Warehouse',
    created_at: new Date().toISOString(),
    created_by: 'u2222222-2222-2222-2222-222222222222'
  }
];

const MOCK_CONSUMABLES: ConsumableStock[] = [
  {
    id: 'con11111-1111-1111-1111-111111111111',
    company_id: MOCK_COMPANY_ID,
    category_id: 'cat33333-3333-3333-3333-333333333333',
    name: 'Cat6 Cable (per meter)',
    sku_code: 'CAB-0001',
    unit_value_ugx: 5000,
    quantity_on_hand: 500,
    reorder_level: 100,
    created_at: new Date().toISOString(),
    created_by: 'u1111111-1111-1111-1111-111111111111'
  }
];

const MOCK_SETTINGS: Settings = {
  id: 's1111111-1111-1111-1111-111111111111',
  company_id: MOCK_COMPANY_ID,
  approval_threshold_ugx: 500000,
  updated_at: new Date().toISOString()
};

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1111111-1111-1111-1111-111111111111',
    company_id: MOCK_COMPANY_ID,
    transaction_type: 'stock_added',
    equipment_id: 'eq111111-1111-1111-1111-111111111111',
    quantity: 1,
    performed_by: 'u1111111-1111-1111-1111-111111111111',
    condition_at_event: 'good',
    notes: 'Initial stock intake',
    entry_method: 'manual',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 't2222222-2222-2222-2222-222222222222',
    company_id: MOCK_COMPANY_ID,
    transaction_type: 'stock_added',
    equipment_id: 'eq222222-2222-2222-2222-222222222222',
    quantity: 1,
    performed_by: 'u1111111-1111-1111-1111-111111111111',
    condition_at_event: 'good',
    notes: 'Initial stock intake',
    entry_method: 'manual',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 't3333333-3333-3333-3333-333333333333',
    company_id: MOCK_COMPANY_ID,
    transaction_type: 'stock_added',
    consumable_id: 'con11111-1111-1111-1111-111111111111',
    quantity: 500,
    performed_by: 'u1111111-1111-1111-1111-111111111111',
    notes: 'Intake of cable drum',
    entry_method: 'manual',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const MOCK_REQUESTS: Request[] = [];
const MOCK_REQUEST_ITEMS: RequestItem[] = [];
const MOCK_PROCUREMENTS: ProcurementRequest[] = [];

// Helper to initialize and retrieve database from localStorage
function getDbState() {
  if (typeof window === 'undefined') {
    return {
      users: MOCK_USERS,
      categories: MOCK_CATEGORIES,
      equipment: MOCK_EQUIPMENT,
      consumables: MOCK_CONSUMABLES,
      settings: MOCK_SETTINGS,
      transactions: MOCK_TRANSACTIONS,
      requests: MOCK_REQUESTS,
      requestItems: MOCK_REQUEST_ITEMS,
      procurements: MOCK_PROCUREMENTS,
      sequences: {} as Record<string, number>
    };
  }

  const stored = localStorage.getItem('equip_track_mock_db');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (!parsed.notifications) parsed.notifications = [];
    if (!parsed.damageReports) parsed.damageReports = [];
    if (!parsed.grnDocuments) parsed.grnDocuments = [];
    if (!parsed.grnItems) parsed.grnItems = [];
    if (!parsed.notificationChannels) parsed.notificationChannels = [];
    if (!parsed.qrLabels) parsed.qrLabels = [];
    if (!parsed.reportExports) parsed.reportExports = [];
    return parsed;
  }

  // Seed initial
  const defaultQrLabels: QrLabel[] = [];
  const seededEquipment = MOCK_EQUIPMENT.map(eq => {
    const labelId = `qr-${eq.id}`;
    defaultQrLabels.push({
      id: labelId,
      company_id: MOCK_COMPANY_ID,
      equipment_id: eq.id,
      label_code: `EQPT:${eq.id}`,
      generated_at: new Date().toISOString()
    });
    return { ...eq, qr_label_id: labelId };
  });

  const seededConsumables = MOCK_CONSUMABLES.map(con => {
    const labelId = `qr-${con.id}`;
    defaultQrLabels.push({
      id: labelId,
      company_id: MOCK_COMPANY_ID,
      consumable_id: con.id,
      label_code: `CONS:${con.id}`,
      generated_at: new Date().toISOString()
    });
    return { ...con, qr_label_id: labelId };
  });

  const mockCashAdvances: CashAdvance[] = [
    {
      id: 'adv-pending-1',
      company_id: MOCK_COMPANY_ID,
      requested_by: 'u3333333-3333-3333-3333-333333333333',
      project_name: 'Kampala Fiber Link',
      purpose: 'Out of pocket allowances for trenching technicians',
      amount_requested_ugx: 750000,
      expected_retirement_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'pending',
      created_at: new Date().toISOString()
    },
    {
      id: 'adv-disbursed-1',
      company_id: MOCK_COMPANY_ID,
      requested_by: 'u3333333-3333-3333-3333-333333333333',
      project_name: 'Entebbe Mast Upgrade',
      purpose: 'Generator transport fuel and emergency materials',
      amount_requested_ugx: 1200000,
      expected_retirement_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      status: 'disbursed',
      approved_by: 'u1111111-1111-1111-1111-111111111111',
      approved_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    },
    {
      id: 'adv-overdue-1',
      company_id: MOCK_COMPANY_ID,
      requested_by: 'u3333333-3333-3333-3333-333333333333',
      project_name: 'Jinja Substation Earthing',
      purpose: 'Copper rod purchases and welder allowances',
      amount_requested_ugx: 950000,
      expected_retirement_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      status: 'overdue',
      approved_by: 'u1111111-1111-1111-1111-111111111111',
      approved_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 10 * 86400000).toISOString()
    }
  ];

  const mockDisbursements: Disbursement[] = [
    {
      id: 'disb-1',
      company_id: MOCK_COMPANY_ID,
      advance_id: 'adv-disbursed-1',
      method: 'bank_transfer',
      amount_ugx: 1200000,
      bank_reference: 'TXN-90210-ENT',
      bank_account: 'DFCU Bank A/C 908123',
      disbursed_by: 'u1111111-1111-1111-1111-111111111111',
      disbursed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    },
    {
      id: 'disb-2',
      company_id: MOCK_COMPANY_ID,
      advance_id: 'adv-overdue-1',
      method: 'cash',
      amount_ugx: 950000,
      witness_name: 'David Warehouse',
      signed_proof_url: 'blob:https://egypro-proof-signed',
      disbursed_by: 'u1111111-1111-1111-1111-111111111111',
      disbursed_at: new Date(Date.now() - 9 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 9 * 86400000).toISOString()
    }
  ];

  const mockRetirementEntries: RetirementEntry[] = [
    {
      id: 'ret-1',
      company_id: MOCK_COMPANY_ID,
      advance_id: 'adv-disbursed-1',
      submitted_by: 'u3333333-3333-3333-3333-333333333333',
      category: 'fuel',
      description: 'Fuel for transport truck Jinja-Kampala',
      amount_ugx: 350000,
      receipt_photo_url: 'blob:https://egypro-receipt-1',
      entry_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    }
  ];

  const state = {
    users: MOCK_USERS,
    categories: MOCK_CATEGORIES,
    equipment: seededEquipment,
    consumables: seededConsumables,
    settings: MOCK_SETTINGS,
    transactions: MOCK_TRANSACTIONS,
    requests: MOCK_REQUESTS,
    requestItems: MOCK_REQUEST_ITEMS,
    procurements: MOCK_PROCUREMENTS,
    notifications: [] as Notification[],
    damageReports: [] as DamageReport[],
    grnDocuments: [] as GrnDocument[],
    grnItems: [] as GrnItem[],
    notificationChannels: [] as NotificationChannel[],
    qrLabels: defaultQrLabels,
    reportExports: [] as ReportExport[],
    cashAdvances: mockCashAdvances,
    disbursements: mockDisbursements,
    retirementEntries: mockRetirementEntries,
    sequences: {
      'cat11111-1111-1111-1111-111111111111': 2,
      'cat22222-2222-2222-2222-222222222222': 2,
      'cat33333-3333-3333-3333-333333333333': 1
    } as Record<string, number>
  };
  localStorage.setItem('equip_track_mock_db', JSON.stringify(state));
  return state;
}

function saveDbState(state: any) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('equip_track_mock_db', JSON.stringify(state));
  }
}

// MOCK SERVICE API METHODS
export const mockDb = {
  login: async (email: string): Promise<User | null> => {
    const state = getDbState();
    const user = state.users.find((u: User) => u.email.toLowerCase() === email.toLowerCase() && u.is_active);
    return user || null;
  },

  getCurrentUser: async (userId: string): Promise<User | null> => {
    const state = getDbState();
    const user = state.users.find((u: User) => u.id === userId && u.is_active);
    return user || null;
  },

  getUsers: async (): Promise<User[]> => {
    return getDbState().users;
  },

  addUser: async (user: Omit<User, 'id' | 'company_id' | 'is_active' | 'created_at'>): Promise<User> => {
    const state = getDbState();
    const newUser: User = {
      ...user,
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      is_active: true,
      created_at: new Date().toISOString()
    };
    state.users.push(newUser);
    saveDbState(state);
    return newUser;
  },

  getSettings: async (): Promise<Settings> => {
    return getDbState().settings;
  },

  updateSettings: async (thresholdUgx: number, updatedBy: string): Promise<Settings> => {
    const state = getDbState();
    state.settings.approval_threshold_ugx = thresholdUgx;
    state.settings.updated_at = new Date().toISOString();
    state.settings.updated_by = updatedBy;
    saveDbState(state);
    return state.settings;
  },

  getCategories: async (): Promise<Category[]> => {
    return getDbState().categories;
  },

  addCategory: async (category: Omit<Category, 'id' | 'company_id'>): Promise<Category> => {
    const state = getDbState();
    const newCat: Category = {
      ...category,
      id: 'cat_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID
    };
    state.categories.push(newCat);
    saveDbState(state);
    return newCat;
  },

  getEquipment: async (): Promise<Equipment[]> => {
    return getDbState().equipment;
  },

  addEquipment: async (item: Omit<Equipment, 'id' | 'company_id' | 'asset_code' | 'created_at' | 'status'>, quantity: number = 1): Promise<Equipment[]> => {
    const state = getDbState();
    const addedItems: Equipment[] = [];

    // Get prefix for code generation
    const category = state.categories.find((c: Category) => c.id === item.category_id);
    const prefix = category ? category.code_prefix : 'EQ';

    if (!state.sequences[item.category_id]) {
      state.sequences[item.category_id] = 0;
    }

    for (let i = 0; i < quantity; i++) {
      state.sequences[item.category_id]++;
      const sequence = state.sequences[item.category_id];
      const assetCode = `${prefix}-${String(sequence).padStart(4, '0')}`;

      const newEq: Equipment = {
        ...item,
        id: 'eq_' + Math.random().toString(36).substr(2, 9),
        company_id: MOCK_COMPANY_ID,
        asset_code: assetCode,
        status: 'available',
        created_at: new Date().toISOString()
      };

      const labelId = 'qr_' + Math.random().toString(36).substr(2, 9);
      const labelCode = `EQPT:${newEq.id}`;
      const newLabel: QrLabel = {
        id: labelId,
        company_id: MOCK_COMPANY_ID,
        equipment_id: newEq.id,
        label_code: labelCode,
        generated_at: new Date().toISOString(),
        generated_by: item.created_by
      };
      if (!state.qrLabels) state.qrLabels = [];
      state.qrLabels.push(newLabel);
      newEq.qr_label_id = labelId;

      state.equipment.push(newEq);
      addedItems.push(newEq);

      // Log stock_added transaction
      const newTx: Transaction = {
        id: 'tx_' + Math.random().toString(36).substr(2, 9),
        company_id: MOCK_COMPANY_ID,
        transaction_type: 'stock_added',
        equipment_id: newEq.id,
        quantity: 1,
        performed_by: item.created_by || '',
        condition_at_event: 'good',
        notes: `Added item: ${newEq.name} (${assetCode})`,
        entry_method: 'manual',
        created_at: new Date().toISOString()
      };
      state.transactions.push(newTx);
    }

    saveDbState(state);
    return addedItems;
  },

  getConsumables: async (): Promise<ConsumableStock[]> => {
    return getDbState().consumables;
  },

  addConsumable: async (item: Omit<ConsumableStock, 'id' | 'company_id' | 'sku_code' | 'created_at'>): Promise<ConsumableStock> => {
    const state = getDbState();

    // Check if sku exists already (by name)
    const existing = state.consumables.find((c: ConsumableStock) => c.name.toLowerCase() === item.name.toLowerCase());
    if (existing) {
      existing.quantity_on_hand += item.quantity_on_hand;
      // Log transaction
      const newTx: Transaction = {
        id: 'tx_' + Math.random().toString(36).substr(2, 9),
        company_id: MOCK_COMPANY_ID,
        transaction_type: 'stock_added',
        consumable_id: existing.id,
        quantity: item.quantity_on_hand,
        performed_by: item.created_by || '',
        notes: `Received additional stock of ${existing.name}`,
        entry_method: 'manual',
        created_at: new Date().toISOString()
      };
      state.transactions.push(newTx);
      saveDbState(state);
      return existing;
    }

    const category = state.categories.find((c: Category) => c.id === item.category_id);
    const prefix = category ? category.code_prefix : 'CON';

    if (!state.sequences[item.category_id]) {
      state.sequences[item.category_id] = 0;
    }
    state.sequences[item.category_id]++;
    const sequence = state.sequences[item.category_id];
    const skuCode = `${prefix}-${String(sequence).padStart(4, '0')}`;

    const newCon: ConsumableStock = {
      ...item,
      id: 'con_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      sku_code: skuCode,
      created_at: new Date().toISOString()
    };

    const labelId = 'qr_' + Math.random().toString(36).substr(2, 9);
    const labelCode = `CONS:${newCon.id}`;
    const newLabel: QrLabel = {
      id: labelId,
      company_id: MOCK_COMPANY_ID,
      consumable_id: newCon.id,
      label_code: labelCode,
      generated_at: new Date().toISOString(),
      generated_by: item.created_by
    };
    if (!state.qrLabels) state.qrLabels = [];
    state.qrLabels.push(newLabel);
    newCon.qr_label_id = labelId;

    state.consumables.push(newCon);

    // Log transaction
    const newTx: Transaction = {
      id: 'tx_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      transaction_type: 'stock_added',
      consumable_id: newCon.id,
      quantity: item.quantity_on_hand,
      performed_by: item.created_by || '',
      notes: `Initial stock added for consumable: ${newCon.name} (${skuCode})`,
      entry_method: 'manual',
      created_at: new Date().toISOString()
    };
    state.transactions.push(newTx);

    saveDbState(state);
    return newCon;
  },

  getRequests: async (): Promise<Request[]> => {
    const state = getDbState();
    return state.requests.map((r: Request) => {
      const pmUser = state.users.find((u: User) => u.id === r.requested_by);
      const items = state.requestItems.filter((ri: RequestItem) => ri.request_id === r.id).map((ri: RequestItem) => {
        if (ri.equipment_id) {
          const eq = state.equipment.find((e: Equipment) => e.id === ri.equipment_id);
          return { ...ri, name: eq?.name, item_type: 'reusable' as const, unit_value_ugx: eq?.unit_value_ugx, asset_code: eq?.asset_code };
        } else {
          const con = state.consumables.find((c: ConsumableStock) => c.id === ri.consumable_id);
          return { ...ri, name: con?.name, item_type: 'consumable' as const, unit_value_ugx: con?.unit_value_ugx, sku_code: con?.sku_code };
        }
      });
      return {
        ...r,
        requested_by_name: pmUser ? pmUser.full_name : 'Unknown PM',
        items
      };
    });
  },

  createRequest: async (
    request: Omit<Request, 'id' | 'company_id' | 'status' | 'routed_to' | 'created_at'>,
    items: Array<{ equipment_id?: string; consumable_id?: string; quantity_requested: number }>
  ): Promise<Request> => {
    const state = getDbState();
    const requestId = 'req_' + Math.random().toString(36).substr(2, 9);
    
    // Determine routing target based on approval rules:
    // Rule: Routes to WM if:
    // - Requested quantity is fully available in stock AND
    // - Unit value of item < 500,000 UGX AND
    // - Requested quantity leaves at least 1 unit remaining in stock after fulfillment (not the last unit).
    // Otherwise, routes to CFO.
    
    const threshold = state.settings.approval_threshold_ugx;
    let routesToCfo = false;

    const requestItemsToSave: RequestItem[] = [];

    for (const item of items) {
      if (item.equipment_id) {
        // Reusable equipment
        const eq = state.equipment.find((e: Equipment) => e.id === item.equipment_id);
        if (!eq) {
          routesToCfo = true;
          continue;
        }

        // Check if value is above threshold
        if (eq.unit_value_ugx >= threshold) {
          routesToCfo = true;
        }

        // Check availability
        if (eq.status !== 'available') {
          routesToCfo = true; // Not fully available in stock
        }

        // Reusable: physical units are individual rows (qty = 1).
        // Check if there is another available unit in the catalog of the same model name.
        // If not, it means this is the "last unit" (leaves 0 available of this model name in stock).
        const availableSameModel = state.equipment.filter((e: Equipment) => e.name === eq.name && e.status === 'available');
        if (availableSameModel.length <= 1) {
          routesToCfo = true; // leaves 0 available of this name
        }

        requestItemsToSave.push({
          id: 'ri_' + Math.random().toString(36).substr(2, 9),
          request_id: requestId,
          equipment_id: item.equipment_id,
          quantity_requested: 1
        });
      } else if (item.consumable_id) {
        // Consumable stock
        const con = state.consumables.find((c: ConsumableStock) => c.id === item.consumable_id);
        if (!con) {
          routesToCfo = true;
          continue;
        }

        if (con.unit_value_ugx >= threshold) {
          routesToCfo = true;
        }

        if (con.quantity_on_hand < item.quantity_requested) {
          routesToCfo = true; // Not fully available
        }

        if (con.quantity_on_hand - item.quantity_requested < 1) {
          routesToCfo = true; // Leaves 0 or negative items in stock (is the last unit)
        }

        requestItemsToSave.push({
          id: 'ri_' + Math.random().toString(36).substr(2, 9),
          request_id: requestId,
          consumable_id: item.consumable_id,
          quantity_requested: item.quantity_requested
        });
      }
    }

    const newRequest: Request = {
      ...request,
      id: requestId,
      company_id: MOCK_COMPANY_ID,
      status: 'pending',
      routed_to: routesToCfo ? 'cfo' : 'warehouse_manager',
      created_at: new Date().toISOString()
    };

    state.requests.push(newRequest);
    state.requestItems.push(...requestItemsToSave);

    // Notify WMs or CFO depending on routing
    const targetRole = routesToCfo ? 'cfo' : 'warehouse_manager';
    const pmUser = state.users.find((u: User) => u.id === request.requested_by);
    const pmName = pmUser ? pmUser.full_name : 'A Project Manager';
    
    // Find matching recipients
    const recipients = state.users.filter((u: User) => u.role === targetRole);
    if (!state.notifications) state.notifications = [];
    recipients.forEach((u: User) => {
      state.notifications.push({
        id: 'nt_' + Math.random().toString(36).substr(2, 9),
        company_id: MOCK_COMPANY_ID,
        user_id: u.id,
        title: 'New Request Pending',
        message: `${pmName} submitted a request for project "${request.project_name}".`,
        link: `/requests/${requestId}`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    });

    saveDbState(state);
    return newRequest;
  },

  approveRequest: async (requestId: string, approverId: string): Promise<Request> => {
    const state = getDbState();
    const req = state.requests.find((r: Request) => r.id === requestId);
    if (!req) throw new Error('Request not found');

    req.status = 'approved';
    req.approved_by = approverId;
    req.approved_at = new Date().toISOString();

    if (!state.notifications) state.notifications = [];

    // Notify PM
    state.notifications.push({
      id: 'nt_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      user_id: req.requested_by,
      title: 'Request Approved',
      message: `Your equipment request for project "${req.project_name}" has been approved.`,
      link: `/requests/${req.id}`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    // Notify all Warehouse Managers that fulfillment is pending
    const wmUsers = state.users.filter((u: User) => u.role === 'warehouse_manager');
    const approverUser = state.users.find((u: User) => u.id === approverId);
    const approverName = approverUser ? approverUser.full_name : 'CFO';

    wmUsers.forEach((wm: User) => {
      state.notifications.push({
        id: 'nt_' + Math.random().toString(36).substr(2, 9),
        company_id: MOCK_COMPANY_ID,
        user_id: wm.id,
        title: 'Pending Fulfillment',
        message: `Request for project "${req.project_name}" approved by ${approverName} is ready for checkout.`,
        link: `/requests/${req.id}`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    });

    saveDbState(state);
    return req;
  },

  rejectRequest: async (requestId: string, approverId: string, reason: string): Promise<Request> => {
    const state = getDbState();
    const req = state.requests.find((r: Request) => r.id === requestId);
    if (!req) throw new Error('Request not found');

    req.status = 'rejected';
    req.approved_by = approverId;
    req.approved_at = new Date().toISOString();
    req.rejection_reason = reason;

    // Notify PM
    if (!state.notifications) state.notifications = [];
    state.notifications.push({
      id: 'nt_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      user_id: req.requested_by,
      title: 'Request Rejected',
      message: `Your request for project "${req.project_name}" was rejected. Reason: ${reason}`,
      link: `/requests/${req.id}`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    saveDbState(state);
    return req;
  },

  checkoutRequest: async (requestId: string, performedBy: string, entryMethod: 'manual' | 'grn' | 'qr_scan' = 'manual'): Promise<Request> => {
    const state = getDbState();
    const req = state.requests.find((r: Request) => r.id === requestId);
    if (!req) throw new Error('Request not found');

    const reqItems = state.requestItems.filter((ri: RequestItem) => ri.request_id === requestId);

    for (const item of reqItems) {
      if (item.equipment_id) {
        const eq = state.equipment.find((e: Equipment) => e.id === item.equipment_id);
        if (eq) {
          eq.status = 'checked_out';
          eq.current_location = req.site_location || 'Field Site';
          
          // Log checkout transaction
          const newTx: Transaction = {
            id: 'tx_' + Math.random().toString(36).substr(2, 9),
            company_id: MOCK_COMPANY_ID,
            transaction_type: 'checkout',
            equipment_id: eq.id,
            request_id: requestId,
            quantity: 1,
            performed_by: performedBy,
            counterparty: req.requested_by,
            notes: `Checked out for project: ${req.project_name}`,
            entry_method: entryMethod,
            created_at: new Date().toISOString()
          };
          state.transactions.push(newTx);
        }
      } else if (item.consumable_id) {
        const con = state.consumables.find((c: ConsumableStock) => c.id === item.consumable_id);
        if (con) {
          con.quantity_on_hand = Math.max(0, con.quantity_on_hand - item.quantity_requested);
          
          // Log stock_consumed transaction
          const newTx: Transaction = {
            id: 'tx_' + Math.random().toString(36).substr(2, 9),
            company_id: MOCK_COMPANY_ID,
            transaction_type: 'stock_consumed',
            consumable_id: con.id,
            request_id: requestId,
            quantity: item.quantity_requested,
            performed_by: performedBy,
            counterparty: req.requested_by,
            notes: `Consumed for project: ${req.project_name}`,
            entry_method: entryMethod,
            created_at: new Date().toISOString()
          };
          state.transactions.push(newTx);
        }
      }
    }

    req.status = 'fulfilled';

    // Notify PM
    if (!state.notifications) state.notifications = [];
    state.notifications.push({
      id: 'nt_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      user_id: req.requested_by,
      title: 'Equipment Dispatched',
      message: `Your requested items for project "${req.project_name}" have been checked out.`,
      link: `/requests/${req.id}`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    saveDbState(state);
    return req;
  },

  returnRequestItem: async (
    requestId: string,
    equipmentId: string,
    condition: 'good' | 'damaged' | 'missing_parts' | 'non_functional',
    notes: string,
    performedBy: string,
    entryMethod: 'manual' | 'grn' | 'qr_scan' = 'manual'
  ): Promise<void> => {
    const state = getDbState();
    const req = state.requests.find((r: Request) => r.id === requestId);
    if (!req) throw new Error('Request not found');

    const eq = state.equipment.find((e: Equipment) => e.id === equipmentId);
    if (!eq) throw new Error('Equipment not found');

    // Update equipment status
    if (condition === 'good') {
      eq.status = 'available';
      eq.current_location = 'Kampala Central Warehouse';
    } else {
      eq.status = 'under_repair';
      eq.current_location = 'Repair Bay';
    }
    eq.condition_notes = notes ? `${notes} (Logged during return)` : `Logged as ${condition} during return.`;

    // Log return transaction
    const returnTxId = 'tx_' + Math.random().toString(36).substr(2, 9);
    const newTx: Transaction = {
      id: returnTxId,
      company_id: MOCK_COMPANY_ID,
      transaction_type: 'return',
      equipment_id: equipmentId,
      request_id: requestId,
      quantity: 1,
      performed_by: performedBy,
      counterparty: req.requested_by,
      condition_at_event: condition,
      notes: notes || `Returned condition: ${condition}`,
      entry_method: entryMethod,
      created_at: new Date().toISOString()
    };
    state.transactions.push(newTx);

    // Auto-create damage report if condition is not good
    let damageReportId: string | undefined = undefined;
    if (condition !== 'good') {
      damageReportId = 'dr_' + Math.random().toString(36).substr(2, 9);
      if (!state.damageReports) state.damageReports = [];
      const newReport: DamageReport = {
        id: damageReportId,
        company_id: MOCK_COMPANY_ID,
        equipment_id: equipmentId,
        originating_transaction_id: returnTxId,
        reported_by: performedBy,
        reported_at: new Date().toISOString(),
        damage_description: notes || `Returned ${condition} condition during return inspection.`,
        status: 'open',
        created_at: new Date().toISOString()
      };
      state.damageReports.push(newReport);
      eq.damage_report_id = damageReportId;
    }

    // Check if all reusable items for this request are returned
    const requestItems = state.requestItems.filter((ri: RequestItem) => ri.request_id === requestId);
    const reusableItems = requestItems.filter((ri: RequestItem) => ri.equipment_id);
    
    // Check how many are currently checked out
    const checkedOutEquipmentIds = reusableItems.map((ri: RequestItem) => ri.equipment_id);
    const stillCheckedOutCount = state.equipment.filter((e: Equipment) => 
      checkedOutEquipmentIds.includes(e.id) && e.status === 'checked_out'
    ).length;

    if (stillCheckedOutCount === 0) {
      req.status = 'returned';
    }

    // Notify PM
    if (!state.notifications) state.notifications = [];
    state.notifications.push({
      id: 'nt_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      user_id: req.requested_by,
      title: 'Equipment Returned',
      message: `"${eq.name}" has been marked as returned (${condition}).`,
      link: `/requests/${req.id}`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    // Notify CFO if damaged & log mock push dispatch
    if (condition !== 'good' && damageReportId) {
      const pmUser = state.users.find((u: User) => u.id === req.requested_by);
      const pmName = pmUser ? pmUser.full_name : 'Project Manager';
      const cfoUsers = state.users.filter((u: User) => u.role === 'cfo');
      
      cfoUsers.forEach((u: User) => {
        state.notifications.push({
          id: 'nt_' + Math.random().toString(36).substr(2, 9),
          company_id: MOCK_COMPANY_ID,
          user_id: u.id,
          title: 'Damaged Asset Alert',
          message: `⚠️ Damage reported: ${eq.asset_code} ${eq.name} returned ${condition} by ${pmName}. Project: ${req.project_name}. Open: /equipment?report=${damageReportId}`,
          link: `/damage-reports`,
          is_read: false,
          created_at: new Date().toISOString()
        });

        // Trigger push mock log
        console.log(`[PUSH NOTICE] Sending push notify alert to CFO (${u.full_name}) via preferred channel for damage report ${damageReportId}`);
      });
    }

    saveDbState(state);
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const state = getDbState();
    return state.transactions.map((tx: Transaction) => {
      const performer = state.users.find((u: User) => u.id === tx.performed_by);
      const counterparty = state.users.find((u: User) => u.id === tx.counterparty);
      
      let itemName = '';
      let code = '';
      if (tx.equipment_id) {
        const eq = state.equipment.find((e: Equipment) => e.id === tx.equipment_id);
        itemName = eq ? eq.name : 'Unknown Equipment';
        code = eq ? eq.asset_code : '';
      } else if (tx.consumable_id) {
        const con = state.consumables.find((c: ConsumableStock) => c.id === tx.consumable_id);
        itemName = con ? con.name : 'Unknown Consumable';
        code = con ? con.sku_code : '';
      }

      return {
        ...tx,
        performed_by_name: performer ? performer.full_name : 'System',
        counterparty_name: counterparty ? counterparty.full_name : '',
        item_name: itemName,
        asset_or_sku_code: code
      };
    }).sort((a: Transaction, b: Transaction) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getProcurements: async (): Promise<ProcurementRequest[]> => {
    const state = getDbState();
    return state.procurements.map((pr: ProcurementRequest) => {
      const category = state.categories.find((c: Category) => c.id === pr.category_id);
      const creator = state.users.find((u: User) => u.id === pr.created_by);
      return {
        ...pr,
        category_name: category ? category.name : 'Unknown',
        created_by_name: creator ? creator.full_name : 'Unknown'
      };
    });
  },

  createProcurement: async (procurement: Omit<ProcurementRequest, 'id' | 'company_id' | 'status' | 'created_at'>): Promise<ProcurementRequest> => {
    const state = getDbState();
    const newPr: ProcurementRequest = {
      ...procurement,
      id: 'pr_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      status: 'requested',
      created_at: new Date().toISOString()
    };
    state.procurements.push(newPr);
    saveDbState(state);
    return newPr;
  },

  receiveProcurement: async (procurementId: string, performedBy: string, status: 'ordered' | 'received'): Promise<ProcurementRequest> => {
    const state = getDbState();
    const pr = state.procurements.find((p: ProcurementRequest) => p.id === procurementId);
    if (!pr) throw new Error('Procurement not found');

    pr.status = status;

    if (status === 'received') {
      // Create actual inventory item(s) depending on category
      const category = state.categories.find((c: Category) => c.id === pr.category_id);
      if (category) {
        if (category.item_type === 'reusable') {
          // Add as reusable equipment (create rows equivalent to quantity)
          const addedItems = [];
          const prefix = category.code_prefix;

          if (!state.sequences[pr.category_id]) {
            state.sequences[pr.category_id] = 0;
          }

          for (let i = 0; i < pr.quantity; i++) {
            state.sequences[pr.category_id]++;
            const sequence = state.sequences[pr.category_id];
            const assetCode = `${prefix}-${String(sequence).padStart(4, '0')}`;

            const newEq: Equipment = {
              id: 'eq_' + Math.random().toString(36).substr(2, 9),
              company_id: MOCK_COMPANY_ID,
              category_id: pr.category_id,
              name: pr.description,
              asset_code: assetCode,
              unit_value_ugx: pr.estimated_cost_ugx / pr.quantity,
              status: 'available',
              condition_notes: 'Received via procurement PO.',
              current_location: 'Kampala Central Warehouse',
              created_at: new Date().toISOString(),
              created_by: performedBy
            };
            state.equipment.push(newEq);
            
            // Log transaction
            const newTx: Transaction = {
              id: 'tx_' + Math.random().toString(36).substr(2, 9),
              company_id: MOCK_COMPANY_ID,
              transaction_type: 'stock_added',
              equipment_id: newEq.id,
              quantity: 1,
              performed_by: performedBy,
              condition_at_event: 'good',
              notes: `Received via procurement PR-${pr.id.substr(3, 4)}`,
              entry_method: 'manual',
              created_at: new Date().toISOString()
            };
            state.transactions.push(newTx);
          }
        } else {
          // Consumable
          // Check if SKU exists already by name
          const existing = state.consumables.find((c: ConsumableStock) => c.name.toLowerCase() === pr.description.toLowerCase());
          if (existing) {
            existing.quantity_on_hand += pr.quantity;
            // Log transaction
            const newTx: Transaction = {
              id: 'tx_' + Math.random().toString(36).substr(2, 9),
              company_id: MOCK_COMPANY_ID,
              transaction_type: 'stock_added',
              consumable_id: existing.id,
              quantity: pr.quantity,
              performed_by: performedBy,
              notes: `Procured stock received. PR-${pr.id.substr(3, 4)}`,
              entry_method: 'manual',
              created_at: new Date().toISOString()
            };
            state.transactions.push(newTx);
          } else {
            const prefix = category.code_prefix;
            if (!state.sequences[pr.category_id]) {
              state.sequences[pr.category_id] = 0;
            }
            state.sequences[pr.category_id]++;
            const sequence = state.sequences[pr.category_id];
            const skuCode = `${prefix}-${String(sequence).padStart(4, '0')}`;

            const newCon: ConsumableStock = {
              id: 'con_' + Math.random().toString(36).substr(2, 9),
              company_id: MOCK_COMPANY_ID,
              category_id: pr.category_id,
              name: pr.description,
              sku_code: skuCode,
              unit_value_ugx: pr.estimated_cost_ugx / pr.quantity,
              quantity_on_hand: pr.quantity,
              reorder_level: 0,
              created_at: new Date().toISOString(),
              created_by: performedBy
            };
            state.consumables.push(newCon);

            // Log transaction
            const newTx: Transaction = {
              id: 'tx_' + Math.random().toString(36).substr(2, 9),
              company_id: MOCK_COMPANY_ID,
              transaction_type: 'stock_added',
              consumable_id: newCon.id,
              quantity: pr.quantity,
              performed_by: performedBy,
              notes: `Procured stock received (New SKU). PR-${pr.id.substr(3, 4)}`,
              entry_method: 'manual',
              created_at: new Date().toISOString()
            };
            state.transactions.push(newTx);
          }
        }
      }
    }

    // Notify CFO (creator of procurement request)
    if (!state.notifications) state.notifications = [];
    const statusText = status === 'received' ? 'arrived and marked received' : 'ordered';
    state.notifications.push({
      id: 'nt_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      user_id: pr.created_by,
      title: `Procurement Order ${status === 'received' ? 'Received' : 'Placed'}`,
      message: `Your procurement request for "${pr.description}" has been ${statusText}.`,
      link: '/procurement',
      is_read: false,
      created_at: new Date().toISOString()
    });

    saveDbState(state);
    return pr;
  },

  checkOverdueItems: async (): Promise<number> => {
    // Scheduled check simulator
    const state = getDbState();
    const today = new Date().toISOString().split('T')[0];
    let updatedCount = 0;

    for (const req of state.requests) {
      if (req.status === 'fulfilled' && req.needed_until && req.needed_until < today) {
        // Find checked out items for this request
        const reqItems = state.requestItems.filter((ri: RequestItem) => ri.request_id === req.id && ri.equipment_id);
        for (const item of reqItems) {
          const eq = state.equipment.find((e: Equipment) => e.id === item.equipment_id && e.status === 'checked_out');
          if (eq) {
            eq.status = 'overdue';
            updatedCount++;
          }
        }
      }
    }

    if (updatedCount > 0) {
      saveDbState(state);
    }
    return updatedCount;
  },

  updateItemValue: async (id: string, type: 'reusable' | 'consumable', newValue: number): Promise<void> => {
    const state = getDbState();
    if (type === 'reusable') {
      const eq = state.equipment.find((e: Equipment) => e.id === id);
      if (eq) {
        eq.unit_value_ugx = newValue;
      }
    } else {
      const con = state.consumables.find((c: ConsumableStock) => c.id === id);
      if (con) {
        con.unit_value_ugx = newValue;
      }
    }
    saveDbState(state);
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    const state = getDbState();
    return (state.notifications || [])
      .filter((n: Notification) => n.user_id === userId)
      .sort((a: Notification, b: Notification) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  createNotification: async (companyId: string, userId: string, title: string, message: string, link: string): Promise<Notification> => {
    const state = getDbState();
    if (!state.notifications) state.notifications = [];
    const newNotif: Notification = {
      id: 'nt_' + Math.random().toString(36).substr(2, 9),
      company_id: companyId,
      user_id: userId,
      title,
      message,
      link,
      is_read: false,
      created_at: new Date().toISOString()
    };
    state.notifications.push(newNotif);
    saveDbState(state);
    return newNotif;
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    const state = getDbState();
    const notif = (state.notifications || []).find((n: Notification) => n.id === id);
    if (notif) {
      notif.is_read = true;
      saveDbState(state);
    }
  },

  markAllNotificationsAsRead: async (userId: string): Promise<void> => {
    const state = getDbState();
    (state.notifications || []).forEach((n: Notification) => {
      if (n.user_id === userId) {
        n.is_read = true;
      }
    });
    saveDbState(state);
  },

  getDamageReports: async (): Promise<DamageReport[]> => {
    const state = getDbState();
    return (state.damageReports || []).map((dr: DamageReport) => {
      const eq = state.equipment.find((e: Equipment) => e.id === dr.equipment_id);
      const reporter = state.users.find((u: User) => u.id === dr.reported_by);
      const resolver = dr.resolved_by ? state.users.find((u: User) => u.id === dr.resolved_by) : undefined;
      return {
        ...dr,
        equipment_name: eq ? eq.name : 'Unknown Equipment',
        equipment_asset_code: eq ? eq.asset_code : '—',
        reported_by_name: reporter ? reporter.full_name : 'Unknown WM',
        resolved_by_name: resolver ? resolver.full_name : undefined
      };
    });
  },

  addDamageReport: async (report: Omit<DamageReport, 'id' | 'company_id' | 'reported_at' | 'status' | 'created_at'>): Promise<DamageReport> => {
    const state = getDbState();
    if (!state.damageReports) state.damageReports = [];
    const newReport: DamageReport = {
      ...report,
      id: 'dr_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      reported_at: new Date().toISOString(),
      status: 'open',
      created_at: new Date().toISOString()
    };
    state.damageReports.push(newReport);

    const eq = state.equipment.find((e: Equipment) => e.id === report.equipment_id);
    if (eq) {
      eq.damage_report_id = newReport.id;
    }
    saveDbState(state);
    return newReport;
  },

  updateDamageReportStatus: async (
    id: string,
    status: 'open' | 'under_repair' | 'resolved' | 'written_off',
    data: {
      estimated_repair_cost_ugx?: number;
      actual_repair_cost_ugx?: number;
      vendor_name?: string;
      resolved_by?: string;
      resolution_notes?: string;
      photos?: string[];
    }
  ): Promise<void> => {
    const state = getDbState();
    const dr = (state.damageReports || []).find((d: DamageReport) => d.id === id);
    if (!dr) throw new Error('Damage report not found');

    dr.status = status;
    if (data.estimated_repair_cost_ugx !== undefined) dr.estimated_repair_cost_ugx = data.estimated_repair_cost_ugx;
    if (data.actual_repair_cost_ugx !== undefined) dr.actual_repair_cost_ugx = data.actual_repair_cost_ugx;
    if (data.vendor_name !== undefined) dr.vendor_name = data.vendor_name;
    if (data.resolution_notes !== undefined) dr.resolution_notes = data.resolution_notes;
    if (data.photos !== undefined) dr.photos = data.photos;

    const eq = state.equipment.find((e: Equipment) => e.id === dr.equipment_id);

    if (status === 'under_repair') {
      if (eq) {
        eq.status = 'under_repair';
        eq.current_location = 'Repair Bay';
      }
      // Log sent_for_repair transaction
      const newTx: Transaction = {
        id: 'tx_' + Math.random().toString(36).substr(2, 9),
        company_id: MOCK_COMPANY_ID,
        transaction_type: 'sent_for_repair' as any,
        equipment_id: dr.equipment_id,
        quantity: 1,
        performed_by: data.resolved_by || dr.reported_by,
        notes: `Sent to vendor: ${data.vendor_name || 'Generic Vendor'}`,
        entry_method: 'manual',
        created_at: new Date().toISOString()
      };
      state.transactions.push(newTx);
    } else if (status === 'resolved') {
      dr.resolved_at = new Date().toISOString();
      dr.resolved_by = data.resolved_by;
      if (eq) {
        eq.status = 'available';
        eq.current_location = 'Kampala Central Warehouse';
        eq.damage_report_id = undefined;
      }
      // Log returned_from_repair transaction
      const newTx: Transaction = {
        id: 'tx_' + Math.random().toString(36).substr(2, 9),
        company_id: MOCK_COMPANY_ID,
        transaction_type: 'returned_from_repair' as any,
        equipment_id: dr.equipment_id,
        quantity: 1,
        performed_by: data.resolved_by || '',
        notes: `Repaired. Cost: ${data.actual_repair_cost_ugx || 0} UGX. Notes: ${data.resolution_notes || ''}`,
        entry_method: 'manual',
        created_at: new Date().toISOString()
      };
      state.transactions.push(newTx);
    } else if (status === 'written_off') {
      dr.resolved_at = new Date().toISOString();
      dr.resolved_by = data.resolved_by;
      if (eq) {
        eq.status = 'retired';
        eq.damage_report_id = undefined;
      }
      // Log retired transaction
      const newTx: Transaction = {
        id: 'tx_' + Math.random().toString(36).substr(2, 9),
        company_id: MOCK_COMPANY_ID,
        transaction_type: 'retired' as any,
        equipment_id: dr.equipment_id,
        quantity: 1,
        performed_by: data.resolved_by || '',
        notes: `Written off - uneconomical to repair. Damage report #${id}`,
        entry_method: 'manual',
        created_at: new Date().toISOString()
      };
      state.transactions.push(newTx);

      // Notify WM
      const wmUsers = state.users.filter((u: User) => u.role === 'warehouse_manager');
      if (!state.notifications) state.notifications = [];
      wmUsers.forEach((wm: User) => {
        state.notifications.push({
          id: 'nt_' + Math.random().toString(36).substr(2, 9),
          company_id: MOCK_COMPANY_ID,
          user_id: wm.id,
          title: 'Asset Written Off',
          message: `Asset ${eq ? eq.asset_code : '—'} written off by CFO. Damage report #${id} closed.`,
          link: `/damage-reports`,
          is_read: false,
          created_at: new Date().toISOString()
        });
      });
    }

    saveDbState(state);
  },

  getGRNDocuments: async (): Promise<GrnDocument[]> => {
    const state = getDbState();
    return (state.grnDocuments || []).map((doc: GrnDocument) => {
      const receiver = state.users.find((u: User) => u.id === doc.received_by);
      const items = (state.grnItems || []).filter((it: GrnItem) => it.grn_id === doc.id);
      const count = items.length;
      const total = items.reduce((sum: number, it: GrnItem) => sum + (parseFloat(it.quantity_received.toString()) * parseFloat(it.unit_value_ugx.toString())), 0);
      return {
        ...doc,
        received_by_name: receiver ? receiver.full_name : 'Unknown WM',
        items_count: count,
        total_value: total
      };
    });
  },

  getGRNItems: async (grnId: string): Promise<GrnItem[]> => {
    const state = getDbState();
    const items = (state.grnItems || []).filter((it: GrnItem) => it.grn_id === grnId);
    return items.map((it: GrnItem) => {
      let name = '';
      let code = '';
      if (it.equipment_id) {
        const eq = state.equipment.find((e: Equipment) => e.id === it.equipment_id);
        name = eq ? eq.name : 'Unknown Equipment';
        code = eq ? eq.asset_code : '—';
      } else if (it.consumable_id) {
        const con = state.consumables.find((c: ConsumableStock) => c.id === it.consumable_id);
        name = con ? con.name : 'Unknown Consumable';
        code = con ? con.sku_code : '—';
      }
      return {
        ...it,
        item_name: name,
        item_code: code
      };
    });
  },

  createGRNDocument: async (
    doc: Omit<GrnDocument, 'id' | 'company_id' | 'grn_number' | 'created_at'>,
    items: Array<{
      item_type: 'reusable' | 'consumable';
      category_id: string;
      name: string;
      quantity_received: number;
      unit_value_ugx: number;
      condition_on_arrival: 'good' | 'damaged' | 'pending_inspection';
      notes?: string;
    }>
  ): Promise<GrnDocument> => {
    const state = getDbState();
    const grnId = 'grn_' + Math.random().toString(36).substr(2, 9);
    
    // Generate GRN Number: GRN-YYYYMMDD-NNNN
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    if (!state.sequences) state.sequences = {};
    const seqKey = `grn_seq_${todayStr}`;
    if (!state.sequences[seqKey]) {
      state.sequences[seqKey] = 0;
    }
    state.sequences[seqKey]++;
    const grnNum = `GRN-${todayStr}-${String(state.sequences[seqKey]).padStart(4, '0')}`;

    const newDoc: GrnDocument = {
      ...doc,
      id: grnId,
      company_id: MOCK_COMPANY_ID,
      grn_number: grnNum,
      created_at: new Date().toISOString()
    };

    if (!state.grnDocuments) state.grnDocuments = [];
    if (!state.grnItems) state.grnItems = [];
    state.grnDocuments.push(newDoc);

    for (const item of items) {
      const grnItemId = 'gi_' + Math.random().toString(36).substr(2, 9);
      if (item.item_type === 'reusable') {
        const category = state.categories.find((c: Category) => c.id === item.category_id);
        const prefix = category ? category.code_prefix : 'EQ';
        
        if (!state.sequences[item.category_id]) {
          state.sequences[item.category_id] = 0;
        }

        // Reusable equipment creates individual rows
        for (let i = 0; i < item.quantity_received; i++) {
          state.sequences[item.category_id]++;
          const seq = state.sequences[item.category_id];
          const assetCode = `${prefix}-${String(seq).padStart(4, '0')}`;
          const eqId = 'eq_' + Math.random().toString(36).substr(2, 9);
          const labelId = 'qr_' + Math.random().toString(36).substr(2, 9);
          const labelCode = `EQPT:${eqId}`;
          
          const newLabel: QrLabel = {
            id: labelId,
            company_id: MOCK_COMPANY_ID,
            equipment_id: eqId,
            label_code: labelCode,
            generated_at: new Date().toISOString(),
            generated_by: doc.received_by
          };
          if (!state.qrLabels) state.qrLabels = [];
          state.qrLabels.push(newLabel);

          const newEq: Equipment = {
            id: eqId,
            company_id: MOCK_COMPANY_ID,
            category_id: item.category_id,
            name: item.name,
            asset_code: assetCode,
            unit_value_ugx: item.unit_value_ugx,
            status: item.condition_on_arrival === 'good' ? 'available' : 'under_repair',
            current_location: item.condition_on_arrival === 'good' ? 'Kampala Central Warehouse' : 'Repair Bay',
            qr_label_id: labelId,
            created_at: new Date().toISOString(),
            created_by: doc.received_by
          };
          state.equipment.push(newEq);          // Log transaction
          const newTxId = 'tx_' + Math.random().toString(36).substr(2, 9);
          state.transactions.push({
            id: newTxId,
            company_id: MOCK_COMPANY_ID,
            transaction_type: 'stock_added' as any,
            equipment_id: eqId,
            quantity: 1,
            performed_by: doc.received_by,
            notes: `Received via GRN ${grnNum}`,
            entry_method: 'grn' as any,
            grn_id: grnId,
            created_at: new Date().toISOString()
          });

          // Create damage report if damaged on arrival
          if (item.condition_on_arrival !== 'good') {
            const drId = 'dr_' + Math.random().toString(36).substr(2, 9);
            const dr: DamageReport = {
              id: drId,
              company_id: MOCK_COMPANY_ID,
              equipment_id: eqId,
              originating_transaction_id: newTxId,
              reported_by: doc.received_by,
              reported_at: new Date().toISOString(),
              damage_description: item.notes || `Received ${item.condition_on_arrival} on arrival via GRN.`,
              status: 'open',
              created_at: new Date().toISOString()
            };
            state.damageReports.push(dr);
            newEq.damage_report_id = drId;
          }

          state.grnItems.push({
            id: grnItemId,
            grn_id: grnId,
            equipment_id: eqId,
            quantity_received: 1,
            unit_value_ugx: item.unit_value_ugx,
            condition_on_arrival: item.condition_on_arrival,
            notes: item.notes
          });
        }
      } else {
        // Consumable
        let conId = '';
        const existing = state.consumables.find((c: ConsumableStock) => c.name.toLowerCase() === item.name.toLowerCase());
        if (existing) {
          existing.quantity_on_hand += item.quantity_received;
          conId = existing.id;
        } else {
          // Create new consumable SKU
          const category = state.categories.find((c: Category) => c.id === item.category_id);
          const prefix = category ? category.code_prefix : 'CON';
          if (!state.sequences[item.category_id]) {
            state.sequences[item.category_id] = 0;
          }
          state.sequences[item.category_id]++;
          const seq = state.sequences[item.category_id];
          const skuCode = `${prefix}-${String(seq).padStart(4, '0')}`;

          const newConId = 'con_' + Math.random().toString(36).substr(2, 9);
          const labelId = 'qr_' + Math.random().toString(36).substr(2, 9);
          const labelCode = `CONS:${newConId}`;
          
          const newLabel: QrLabel = {
            id: labelId,
            company_id: MOCK_COMPANY_ID,
            consumable_id: newConId,
            label_code: labelCode,
            generated_at: new Date().toISOString(),
            generated_by: doc.received_by
          };
          if (!state.qrLabels) state.qrLabels = [];
          state.qrLabels.push(newLabel);

          const newCon: ConsumableStock = {
            id: newConId,
            company_id: MOCK_COMPANY_ID,
            category_id: item.category_id,
            name: item.name,
            sku_code: skuCode,
            unit_value_ugx: item.unit_value_ugx,
            quantity_on_hand: item.quantity_received,
            reorder_level: 0,
            qr_label_id: labelId,
            created_at: new Date().toISOString(),
            created_by: doc.received_by
          };
          state.consumables.push(newCon);
          conId = newConId;        }

        // Log transaction
        state.transactions.push({
          id: 'tx_' + Math.random().toString(36).substr(2, 9),
          company_id: MOCK_COMPANY_ID,
          transaction_type: 'stock_added' as any,
          consumable_id: conId,
          quantity: item.quantity_received,
          performed_by: doc.received_by,
          notes: `Received via GRN ${grnNum}`,
          entry_method: 'grn' as any,
          grn_id: grnId,
          created_at: new Date().toISOString()
        });

        state.grnItems.push({
          id: grnItemId,
          grn_id: grnId,
          consumable_id: conId,
          quantity_received: item.quantity_received,
          unit_value_ugx: item.unit_value_ugx,
          condition_on_arrival: item.condition_on_arrival,
          notes: item.notes
        });
      }
    }

    saveDbState(state);
    return newDoc;
  },

  getNotificationChannels: async (): Promise<NotificationChannel[]> => {
    const state = getDbState();
    return state.notificationChannels || [];
  },

  saveNotificationChannel: async (channel: Omit<NotificationChannel, 'id' | 'updated_at'>): Promise<void> => {
    const state = getDbState();
    if (!state.notificationChannels) state.notificationChannels = [];
    const existing = state.notificationChannels.find((nc: NotificationChannel) => nc.user_id === channel.user_id);
    if (existing) {
      existing.whatsapp_number = channel.whatsapp_number;
      existing.email_enabled = channel.email_enabled;
      existing.preferred_channel = channel.preferred_channel;
      existing.is_active = channel.is_active;
      existing.updated_at = new Date().toISOString();
    } else {
      state.notificationChannels.push({
        id: 'nc_' + Math.random().toString(36).substr(2, 9),
        ...channel,
        updated_at: new Date().toISOString()
      });
    }
    saveDbState(state);
  },

  getQrLabelByCode: async (code: string): Promise<QrLabel | null> => {
    const state = getDbState();
    return state.qrLabels.find((q: QrLabel) => q.label_code === code) || null;
  },

  generateQrLabel: async (target: { equipment_id?: string; consumable_id?: string; company_id: string; generated_by: string }): Promise<QrLabel> => {
    const state = getDbState();
    const id = 'qr_' + Math.random().toString(36).substr(2, 9);
    const label_code = target.equipment_id ? `EQPT:${target.equipment_id}` : `CONS:${target.consumable_id}`;
    
    // Check if it already exists
    const existing = state.qrLabels.find((q: QrLabel) => q.label_code === label_code);
    if (existing) return existing;

    const newLabel: QrLabel = {
      id,
      company_id: target.company_id,
      equipment_id: target.equipment_id,
      consumable_id: target.consumable_id,
      label_code,
      generated_at: new Date().toISOString(),
      generated_by: target.generated_by
    };
    state.qrLabels.push(newLabel);

    // Update equipment/consumable table reference
    if (target.equipment_id) {
      const eq = state.equipment.find((e: Equipment) => e.id === target.equipment_id);
      if (eq) eq.qr_label_id = id;
    } else if (target.consumable_id) {
      const con = state.consumables.find((c: ConsumableStock) => c.id === target.consumable_id);
      if (con) con.qr_label_id = id;
    }

    saveDbState(state);
    return newLabel;
  },

  markQrLabelPrinted: async (labelId: string): Promise<void> => {
    const state = getDbState();
    const label = state.qrLabels.find((q: QrLabel) => q.id === labelId);
    if (label) {
      label.printed_at = new Date().toISOString();
      saveDbState(state);
    }
  },

  getReportExports: async (): Promise<ReportExport[]> => {
    const state = getDbState();
    return (state.reportExports || []).map((re: ReportExport) => {
      const usr = state.users.find((u: User) => u.id === re.generated_by);
      return {
        ...re,
        generated_by_name: usr ? usr.full_name : 'System'
      };
    });
  },

  createReportExport: async (data: Omit<ReportExport, 'id' | 'generated_at'>): Promise<ReportExport> => {
    const state = getDbState();
    const id = 'rep_' + Math.random().toString(36).substr(2, 9);
    const newReport: ReportExport = {
      id,
      generated_at: new Date().toISOString(),
      ...data
    };
    if (!state.reportExports) state.reportExports = [];
    state.reportExports.push(newReport);
    saveDbState(state);
    
    // Add UI helper for returned data
    const usr = state.users.find((u: User) => u.id === data.generated_by);
    return {
      ...newReport,
      generated_by_name: usr ? usr.full_name : 'System'
    };
  },

  getCashAdvances: async (role: 'pm' | 'warehouse_manager' | 'cfo', userId: string): Promise<CashAdvance[]> => {
    const state = getDbState();
    const advances = state.cashAdvances || [];
    
    // Filter based on role
    const filtered = role === 'cfo' 
      ? advances 
      : advances.filter((a: CashAdvance) => a.requested_by === userId);

    // Map live balances and UI helpers
    return filtered.map((adv: CashAdvance) => {
      const pmUser = state.users.find((u: User) => u.id === adv.requested_by);
      const disb = (state.disbursements || []).find((d: Disbursement) => d.advance_id === adv.id);
      const rets = (state.retirementEntries || []).filter((r: RetirementEntry) => r.advance_id === adv.id);
      
      const amount_disbursed_ugx = disb ? Number(disb.amount_ugx) : 0;
      const amount_retired_ugx = rets.reduce((sum: number, r: RetirementEntry) => sum + Number(r.amount_ugx), 0);
      const outstanding_ugx = Math.max(0, amount_disbursed_ugx - amount_retired_ugx);

      return {
        ...adv,
        requested_by_name: pmUser ? pmUser.full_name : 'PM Operator',
        amount_disbursed_ugx,
        amount_retired_ugx,
        outstanding_ugx
      };
    });
  },

  requestCashAdvance: async (
    advance: Omit<CashAdvance, 'id' | 'company_id' | 'status' | 'created_at'>
  ): Promise<CashAdvance> => {
    const state = getDbState();
    const advances = state.cashAdvances || [];

    // Enforce overdue check blocking
    const hasOverdue = advances.some((a: CashAdvance) => a.requested_by === advance.requested_by && a.status === 'overdue');
    if (hasOverdue) {
      throw new Error('Blocked: You have overdue cash advances that must be accounted for first.');
    }

    const id = 'adv_' + Math.random().toString(36).substr(2, 9);
    const newAdv: CashAdvance = {
      id,
      company_id: MOCK_COMPANY_ID,
      status: 'pending',
      created_at: new Date().toISOString(),
      ...advance
    };

    if (!state.cashAdvances) state.cashAdvances = [];
    state.cashAdvances.push(newAdv);
    saveDbState(state);

    const pmUser = state.users.find((u: User) => u.id === advance.requested_by);
    return {
      ...newAdv,
      requested_by_name: pmUser ? pmUser.full_name : 'PM Operator',
      amount_disbursed_ugx: 0,
      amount_retired_ugx: 0,
      outstanding_ugx: 0
    };
  },

  approveCashAdvance: async (id: string, approverId: string): Promise<CashAdvance> => {
    const state = getDbState();
    const advances = state.cashAdvances || [];
    const adv = advances.find((a: CashAdvance) => a.id === id);
    if (!adv) throw new Error('Cash advance request not found.');

    adv.status = 'approved';
    adv.approved_by = approverId;
    adv.approved_at = new Date().toISOString();
    saveDbState(state);

    return adv;
  },

  rejectCashAdvance: async (id: string, approverId: string, reason: string): Promise<CashAdvance> => {
    const state = getDbState();
    const advances = state.cashAdvances || [];
    const adv = advances.find((a: CashAdvance) => a.id === id);
    if (!adv) throw new Error('Cash advance request not found.');

    adv.status = 'rejected';
    adv.approved_by = approverId;
    adv.approved_at = new Date().toISOString();
    adv.rejection_reason = reason;
    saveDbState(state);

    return adv;
  },

  disburseAdvance: async (
    disb: Omit<Disbursement, 'id' | 'company_id' | 'created_at' | 'disbursed_at'>
  ): Promise<void> => {
    const state = getDbState();
    const advances = state.cashAdvances || [];
    const adv = advances.find((a: CashAdvance) => a.id === disb.advance_id);
    if (!adv) throw new Error('Cash advance request not found.');

    if (disb.method === 'bank_transfer' && (!disb.bank_reference || !disb.bank_account)) {
      throw new Error('Invalid disbursement: Bank reference and bank account are required for transfer disbursements.');
    }
    if (disb.method === 'cash' && (!disb.witness_name || !disb.signed_proof_url)) {
      throw new Error('Invalid disbursement: Witness name and signed proof receipt upload are required for cash handovers.');
    }

    const id = 'disb_' + Math.random().toString(36).substr(2, 9);
    const newDisb: Disbursement = {
      id,
      company_id: MOCK_COMPANY_ID,
      created_at: new Date().toISOString(),
      disbursed_at: new Date().toISOString(),
      ...disb
    };

    if (!state.disbursements) state.disbursements = [];
    state.disbursements.push(newDisb);

    adv.status = 'disbursed';
    saveDbState(state);
  },

  submitRetirementEntry: async (
    entry: Omit<RetirementEntry, 'id' | 'company_id' | 'created_at'>
  ): Promise<void> => {
    const state = getDbState();
    const advances = state.cashAdvances || [];
    const adv = advances.find((a: CashAdvance) => a.id === entry.advance_id);
    if (!adv) throw new Error('Cash advance request not found.');

    const id = 'ret_' + Math.random().toString(36).substr(2, 9);
    const newEntry: RetirementEntry = {
      id,
      company_id: MOCK_COMPANY_ID,
      created_at: new Date().toISOString(),
      ...entry
    };

    if (!state.retirementEntries) state.retirementEntries = [];
    state.retirementEntries.push(newEntry);

    // Compute live balance progress
    const disb = (state.disbursements || []).find((d: Disbursement) => d.advance_id === adv.id);
    const rets = (state.retirementEntries || []).filter((r: RetirementEntry) => r.advance_id === adv.id);
    
    const amount_disbursed_ugx = disb ? Number(disb.amount_ugx) : 0;
    const amount_retired_ugx = rets.reduce((sum: number, r: RetirementEntry) => sum + Number(r.amount_ugx), 0);

    if (amount_retired_ugx >= amount_disbursed_ugx) {
      adv.status = 'retired';
    } else {
      adv.status = 'partially_retired';
    }

    saveDbState(state);
  },

  getRetirementEntries: async (advanceId: string): Promise<RetirementEntry[]> => {
    const state = getDbState();
    return (state.retirementEntries || []).filter((r: RetirementEntry) => r.advance_id === advanceId);
  },

  checkOverdueAdvances: async (): Promise<void> => {
    const state = getDbState();
    const advances = state.cashAdvances || [];
    const today = new Date().toISOString().split('T')[0];

    advances.forEach((adv: CashAdvance) => {
      if (['disbursed', 'partially_retired'].includes(adv.status) && adv.expected_retirement_date < today) {
        adv.status = 'overdue';

        // Notify PM
        state.notifications.push({
          id: 'notif_' + Math.random().toString(36).substr(2, 9),
          company_id: MOCK_COMPANY_ID,
          user_id: adv.requested_by,
          title: 'Cash Advance Overdue',
          message: `Your advance for project ${adv.project_name} is overdue. Please submit accountability receipts.`,
          link: '/advances',
          is_read: false,
          created_at: new Date().toISOString()
        });

        // Notify CFOs
        state.users.filter((u: User) => u.role === 'cfo').forEach((cfo: User) => {
          state.notifications.push({
            id: 'notif_' + Math.random().toString(36).substr(2, 9),
            company_id: MOCK_COMPANY_ID,
            user_id: cfo.id,
            title: 'PM Cash Advance Overdue',
            message: `An advance of ${adv.amount_requested_ugx} UGX is overdue for accountability checks.`,
            link: '/advances',
            is_read: false,
            created_at: new Date().toISOString()
          });
        });
      }
    });

    saveDbState(state);
  }
};
