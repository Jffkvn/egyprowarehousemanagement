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
  entry_method: 'manual';
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
    return JSON.parse(stored);
  }

  // Seed initial
  const state = {
    users: MOCK_USERS,
    categories: MOCK_CATEGORIES,
    equipment: MOCK_EQUIPMENT,
    consumables: MOCK_CONSUMABLES,
    settings: MOCK_SETTINGS,
    transactions: MOCK_TRANSACTIONS,
    requests: MOCK_REQUESTS,
    requestItems: MOCK_REQUEST_ITEMS,
    procurements: MOCK_PROCUREMENTS,
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

    saveDbState(state);
    return req;
  },

  checkoutRequest: async (requestId: string, performedBy: string): Promise<Request> => {
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
            entry_method: 'manual',
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
            entry_method: 'manual',
            created_at: new Date().toISOString()
          };
          state.transactions.push(newTx);
        }
      }
    }

    req.status = 'fulfilled';
    saveDbState(state);
    return req;
  },

  returnRequestItem: async (
    requestId: string,
    equipmentId: string,
    condition: 'good' | 'damaged' | 'missing_parts' | 'non_functional',
    notes: string,
    performedBy: string
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
    const newTx: Transaction = {
      id: 'tx_' + Math.random().toString(36).substr(2, 9),
      company_id: MOCK_COMPANY_ID,
      transaction_type: 'return',
      equipment_id: equipmentId,
      request_id: requestId,
      quantity: 1,
      performed_by: performedBy,
      counterparty: req.requested_by,
      condition_at_event: condition,
      notes: notes || `Returned condition: ${condition}`,
      entry_method: 'manual',
      created_at: new Date().toISOString()
    };
    state.transactions.push(newTx);

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
  }
};
