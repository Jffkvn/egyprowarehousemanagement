// Unified Database Client for Egypro EquipTrack (Phase One)
// Delegates queries to Supabase if configured, or falls back to Mock LocalStorage.

import { supabase } from './supabaseClient';
import { mockDb, User, Category, Equipment, ConsumableStock, Request, Transaction, ProcurementRequest, Settings, RequestItem, Notification, DamageReport, GrnDocument, GrnItem, NotificationChannel, QrLabel, ReportExport, CashAdvance, Disbursement, RetirementEntry, Project, ProjectAssignment } from './mockDb';

export type { User, Category, Equipment, ConsumableStock, Request, Transaction, ProcurementRequest, Settings, RequestItem, Notification, DamageReport, GrnDocument, GrnItem, NotificationChannel, QrLabel, ReportExport, CashAdvance, Disbursement, RetirementEntry, Project, ProjectAssignment };

// Helper to determine if we should use Supabase or fallback to mock
const useSupabase = () => {
  return supabase !== null;
};

// Resolve the active user's company id dynamically without relying on select limit 1
const getCompanyId = async (): Promise<string> => {
  const { data: { user: authUser } } = await supabase!.auth.getUser();
  if (!authUser) throw new Error('User not authenticated');
  const { data: profile, error } = await supabase!
    .from('users')
    .select('company_id')
    .eq('id', authUser.id)
    .single();
  if (error || !profile) throw new Error('Could not resolve company profile');
  return profile.company_id;
};

export const db = {
  isSupabaseConfigured: () => {
    return useSupabase();
  },

  login: async (email: string): Promise<User | null> => {
    if (!useSupabase()) {
      return mockDb.login(email);
    }
    try {
      // In Supabase mode, we assume the user already did authentication in auth.users.
      // We will fetch their profile from the users table.
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data as User;
    } catch (e) {
      console.warn('Supabase login failed, using mock database:', e);
      return mockDb.login(email);
    }
  },

  getCurrentUser: async (userId: string): Promise<User | null> => {
    if (!useSupabase()) {
      return mockDb.getCurrentUser(userId);
    }
    try {
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data as User;
    } catch (e) {
      console.warn('Supabase getCurrentUser failed, using mock database:', e);
      return mockDb.getCurrentUser(userId);
    }
  },

  getUsers: async (): Promise<User[]> => {
    if (!useSupabase()) {
      return mockDb.getUsers();
    }
    try {
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as User[];
    } catch (e) {
      console.warn('Supabase getUsers failed, using mock database:', e);
      return mockDb.getUsers();
    }
  },

  addUser: async (user: Omit<User, 'id' | 'company_id' | 'is_active' | 'created_at'> & { password?: string }): Promise<User> => {
    if (!useSupabase()) {
      return mockDb.addUser(user);
    }
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password || 'password123',
          full_name: user.full_name,
          role: user.role,
          phone: user.phone || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      return data.user as User;
    } catch (e) {
      console.warn('Supabase addUser via API failed, using mock database:', e);
      return mockDb.addUser(user);
    }
  },

  getSettings: async (): Promise<Settings> => {
    if (!useSupabase()) {
      return mockDb.getSettings();
    }
    try {
      const { data, error } = await supabase!
        .from('settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as Settings;
    } catch (e) {
      console.warn('Supabase getSettings failed, using mock database:', e);
      return mockDb.getSettings();
    }
  },

  updateSettings: async (thresholdUgx: number, updatedBy: string): Promise<Settings> => {
    if (!useSupabase()) {
      return mockDb.updateSettings(thresholdUgx, updatedBy);
    }
    try {
      const { data: settingsData } = await supabase!.from('settings').select('id').limit(1).single();
      const { data, error } = await supabase!
        .from('settings')
        .update({ approval_threshold_ugx: thresholdUgx, updated_at: new Date().toISOString(), updated_by: updatedBy })
        .eq('id', settingsData?.id)
        .select()
        .single();
      if (error) throw error;
      return data as Settings;
    } catch (e) {
      console.warn('Supabase updateSettings failed, using mock database:', e);
      return mockDb.updateSettings(thresholdUgx, updatedBy);
    }
  },

  getCategories: async (): Promise<Category[]> => {
    if (!useSupabase()) {
      return mockDb.getCategories();
    }
    try {
      const { data, error } = await supabase!
        .from('equipment_categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Category[];
    } catch (e) {
      console.warn('Supabase getCategories failed, using mock database:', e);
      return mockDb.getCategories();
    }
  },

  addCategory: async (category: Omit<Category, 'id' | 'company_id'>): Promise<Category> => {
    if (!useSupabase()) {
      return mockDb.addCategory(category);
    }
    try {
      const companyId = await getCompanyId();
      const { data, error } = await supabase!
        .from('equipment_categories')
        .insert({
          company_id: companyId,
          name: category.name,
          code_prefix: category.code_prefix,
          item_type: category.item_type
        })
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase addCategory failed, using mock database:', e);
      return mockDb.addCategory(category);
    }
  },

  getEquipment: async (): Promise<Equipment[]> => {
    if (!useSupabase()) {
      return mockDb.getEquipment();
    }
    try {
      const { data, error } = await supabase!
        .from('equipment')
        .select('*')
        .order('asset_code', { ascending: true });
      if (error) throw error;
      return data as Equipment[];
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase getEquipment failed, using mock database:', e);
      return mockDb.getEquipment();
    }
  },

  addEquipment: async (item: Omit<Equipment, 'id' | 'company_id' | 'asset_code' | 'created_at' | 'status'>, quantity: number = 1): Promise<Equipment[]> => {
    if (!useSupabase()) {
      return mockDb.addEquipment(item, quantity);
    }
    try {
      const companyId = await getCompanyId();

      const addedItems: Equipment[] = [];
      for (let i = 0; i < quantity; i++) {
        // Trigger in database automatically populates asset_code
        const { data, error } = await supabase!
          .from('equipment')
          .insert({
            company_id: companyId,
            category_id: item.category_id,
            name: item.name,
            manufacturer_serial: item.manufacturer_serial || null,
            unit_value_ugx: item.unit_value_ugx,
            status: 'available',
            condition_notes: item.condition_notes || null,
            current_location: item.current_location || 'Kampala Central Warehouse',
            created_by: item.created_by
          })
          .select()
          .single();

        if (error) throw error;
        const newEq = data as Equipment;
        addedItems.push(newEq);

        // Log transaction
        await supabase!.from('transactions').insert({
          company_id: companyId,
          transaction_type: 'stock_added',
          equipment_id: newEq.id,
          quantity: 1,
          performed_by: item.created_by,
          condition_at_event: 'good',
          notes: `Added item: ${newEq.name}`,
          entry_method: 'manual'
        });
      }
      return addedItems;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase addEquipment failed, using mock database:', e);
      return mockDb.addEquipment(item, quantity);
    }
  },

  getConsumables: async (): Promise<ConsumableStock[]> => {
    if (!useSupabase()) {
      return mockDb.getConsumables();
    }
    try {
      const { data, error } = await supabase!
        .from('consumable_stock')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as ConsumableStock[];
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase getConsumables failed, using mock database:', e);
      return mockDb.getConsumables();
    }
  },

  addConsumable: async (item: Omit<ConsumableStock, 'id' | 'company_id' | 'sku_code' | 'created_at'>): Promise<ConsumableStock> => {
    if (!useSupabase()) {
      return mockDb.addConsumable(item);
    }
    try {
      const companyId = await getCompanyId();

      // Check if SKU exists already by name
      const { data: existing, error: findError } = await supabase!
        .from('consumable_stock')
        .select('*')
        .eq('name', item.name)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { data, error: updateError } = await supabase!
          .from('consumable_stock')
          .update({ quantity_on_hand: existing.quantity_on_hand + item.quantity_on_hand })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Log transaction
        await supabase!.from('transactions').insert({
          company_id: companyId,
          transaction_type: 'stock_added',
          consumable_id: existing.id,
          quantity: item.quantity_on_hand,
          performed_by: item.created_by,
          notes: `Added ${item.quantity_on_hand} units to existing stock of ${existing.name}`,
          entry_method: 'manual'
        });

        return data as ConsumableStock;
      }

      // Insert new SKU (trigger generates code)
      const { data, error } = await supabase!
        .from('consumable_stock')
        .insert({
          company_id: companyId,
          category_id: item.category_id,
          name: item.name,
          unit_value_ugx: item.unit_value_ugx,
          quantity_on_hand: item.quantity_on_hand,
          reorder_level: item.reorder_level,
          created_by: item.created_by
        })
        .select()
        .single();

      if (error) throw error;
      const newCon = data as ConsumableStock;

      // Log transaction
      await supabase!.from('transactions').insert({
        company_id: companyId,
        transaction_type: 'stock_added',
        consumable_id: newCon.id,
        quantity: item.quantity_on_hand,
        performed_by: item.created_by,
        notes: `Intake of new consumable stock SKU: ${newCon.name}`,
        entry_method: 'manual'
      });

      return newCon as ConsumableStock;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase addConsumable failed, using mock database:', e);
      return mockDb.addConsumable(item);
    }
  },

  getRequests: async (): Promise<Request[]> => {
    if (!useSupabase()) {
      return mockDb.getRequests();
    }
    try {
      // Read requests and join request items
      const { data: reqs, error } = await supabase!
        .from('requests')
        .select(`
          *,
          users:requested_by (full_name),
          request_items (
            id,
            request_id,
            equipment_id,
            consumable_id,
            quantity_requested
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load all catalog items to populate names in request items
      const { data: eqs } = await supabase!.from('equipment').select('id, name, unit_value_ugx, asset_code');
      const { data: cons } = await supabase!.from('consumable_stock').select('id, name, unit_value_ugx, sku_code');

      const eqMap = new Map(eqs?.map(e => [e.id, e]));
      const conMap = new Map(cons?.map(c => [c.id, c]));

      return reqs.map((r: any) => {
        const items = r.request_items?.map((ri: any) => {
          if (ri.equipment_id) {
            const eq = eqMap.get(ri.equipment_id);
            return {
              ...ri,
              name: eq?.name,
              item_type: 'reusable',
              unit_value_ugx: eq?.unit_value_ugx,
              asset_code: eq?.asset_code
            };
          } else {
            const con = conMap.get(ri.consumable_id);
            return {
              ...ri,
              name: con?.name,
              item_type: 'consumable',
              unit_value_ugx: con?.unit_value_ugx,
              sku_code: con?.sku_code
            };
          }
        }) || [];

        return {
          id: r.id,
          company_id: r.company_id,
          requested_by: r.requested_by,
          project_name: r.project_name,
          site_location: r.site_location,
          needed_from: r.needed_from,
          needed_until: r.needed_until,
          status: r.status,
          routed_to: r.routed_to,
          approved_by: r.approved_by,
          approved_at: r.approved_at,
          rejection_reason: r.rejection_reason,
          created_at: r.created_at,
          requested_by_name: r.users?.full_name || 'Unknown',
          items
        } as Request;
      });
    } catch (e) {
      console.warn('Supabase getRequests failed, using mock database:', e);
      return mockDb.getRequests();
    }
  },

  createRequest: async (
    request: Omit<Request, 'id' | 'company_id' | 'status' | 'routed_to' | 'created_at'>,
    items: Array<{ equipment_id?: string; consumable_id?: string; quantity_requested: number }>
  ): Promise<Request> => {
    if (!useSupabase()) {
      return mockDb.createRequest(request, items);
    }
    try {
      const { data: requestId, error } = await supabase!.rpc('rpc_create_request', {
        p_project_name: request.project_name,
        p_site_location: request.site_location || null,
        p_needed_from: request.needed_from,
        p_needed_until: request.needed_until || null,
        p_items: items // pass as json array directly
      });

      if (error) throw error;

      const { data: newRequest, error: fetchError } = await supabase!
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;
      return newRequest as Request;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase createRequest failed, using mock database:', e);
      return mockDb.createRequest(request, items);
    }
  },

  approveRequest: async (requestId: string, approverId: string): Promise<Request> => {
    if (!useSupabase()) {
      return mockDb.approveRequest(requestId, approverId);
    }
    try {
      const { data, error } = await supabase!
        .from('requests')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();
      if (error) throw error;
      return data as Request;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase approveRequest failed, using mock database:', e);
      return mockDb.approveRequest(requestId, approverId);
    }
  },

  rejectRequest: async (requestId: string, approverId: string, reason: string): Promise<Request> => {
    if (!useSupabase()) {
      return mockDb.rejectRequest(requestId, approverId, reason);
    }
    try {
      const { data, error } = await supabase!
        .from('requests')
        .update({
          status: 'rejected',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', requestId)
        .select()
        .single();
      if (error) throw error;
      return data as Request;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase rejectRequest failed, using mock database:', e);
      return mockDb.rejectRequest(requestId, approverId, reason);
    }
  },

  checkoutRequest: async (requestId: string, performedBy: string, entryMethod: 'manual' | 'grn' | 'qr_scan' = 'manual'): Promise<Request> => {
    if (!useSupabase()) {
      return mockDb.checkoutRequest(requestId, performedBy, entryMethod);
    }
    try {
      const { error } = await supabase!.rpc('rpc_checkout_request', {
        p_request_id: requestId,
        p_entry_method: entryMethod
      });

      if (error) throw error;

      const { data, error: fetchError } = await supabase!
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;
      return data as Request;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase checkoutRequest failed, using mock database:', e);
      return mockDb.checkoutRequest(requestId, performedBy, entryMethod);
    }
  },

  returnRequestItem: async (
    requestId: string,
    equipmentId: string,
    condition: 'good' | 'damaged' | 'missing_parts' | 'non_functional',
    notes: string,
    performedBy: string,
    entryMethod: 'manual' | 'grn' | 'qr_scan' = 'manual'
  ): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.returnRequestItem(requestId, equipmentId, condition, notes, performedBy, entryMethod);
    }
    try {
      const { error } = await supabase!.rpc('rpc_return_request_item', {
        p_request_id: requestId,
        p_equipment_id: equipmentId,
        p_condition: condition,
        p_notes: notes || '',
        p_entry_method: entryMethod
      });

      if (error) throw error;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase returnRequestItem failed, using mock database:', e);
      return mockDb.returnRequestItem(requestId, equipmentId, condition, notes, performedBy, entryMethod);
    }
  },

  getTransactions: async (): Promise<Transaction[]> => {
    if (!useSupabase()) {
      return mockDb.getTransactions();
    }
    try {
      // Fetch transactions with related names
      const { data, error } = await supabase!
        .from('transactions')
        .select(`
          *,
          performer:users!transactions_performed_by_fkey (full_name),
          counterparty_user:users!transactions_counterparty_fkey (full_name),
          equipment (name, asset_code),
          consumable_stock (name, sku_code)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((tx: any) => {
        let itemName = '';
        let code = '';
        if (tx.equipment) {
          itemName = tx.equipment.name;
          code = tx.equipment.asset_code;
        } else if (tx.consumable_stock) {
          itemName = tx.consumable_stock.name;
          code = tx.consumable_stock.sku_code;
        }

        return {
          id: tx.id,
          company_id: tx.company_id,
          transaction_type: tx.transaction_type,
          equipment_id: tx.equipment_id,
          consumable_id: tx.consumable_id,
          request_id: tx.request_id,
          quantity: tx.quantity,
          performed_by: tx.performed_by,
          counterparty: tx.counterparty,
          condition_at_event: tx.condition_at_event,
          notes: tx.notes,
          entry_method: tx.entry_method,
          created_at: tx.created_at,
          performed_by_name: tx.performer?.full_name || 'System',
          counterparty_name: tx.counterparty_user?.full_name || '',
          item_name: itemName,
          asset_or_sku_code: code
        } as Transaction;
      });
    } catch (e) {
      console.warn('Supabase getTransactions failed, using mock database:', e);
      return mockDb.getTransactions();
    }
  },

  getProcurements: async (): Promise<ProcurementRequest[]> => {
    if (!useSupabase()) {
      return mockDb.getProcurements();
    }
    try {
      const { data, error } = await supabase!
        .from('procurement_requests')
        .select(`
          *,
          equipment_categories (name),
          users!procurement_requests_created_by_fkey (full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((pr: any) => ({
        id: pr.id,
        company_id: pr.company_id,
        category_id: pr.category_id,
        description: pr.description,
        estimated_cost_ugx: pr.estimated_cost_ugx,
        quantity: pr.quantity,
        status: pr.status,
        created_by: pr.created_by,
        created_at: pr.created_at,
        category_name: pr.equipment_categories?.name || 'Unknown',
        created_by_name: pr.users?.full_name || 'Unknown'
      })) as ProcurementRequest[];
    } catch (e) {
      console.warn('Supabase getProcurements failed, using mock database:', e);
      return mockDb.getProcurements();
    }
  },

  createProcurement: async (procurement: Omit<ProcurementRequest, 'id' | 'company_id' | 'status' | 'created_at'>): Promise<ProcurementRequest> => {
    if (!useSupabase()) {
      return mockDb.createProcurement(procurement);
    }
    try {
      const companyId = await getCompanyId();
      const { data, error } = await supabase!
        .from('procurement_requests')
        .insert({
          company_id: companyId,
          category_id: procurement.category_id,
          description: procurement.description,
          estimated_cost_ugx: procurement.estimated_cost_ugx,
          quantity: procurement.quantity,
          status: 'requested',
          created_by: procurement.created_by
        })
        .select()
        .single();

      if (error) throw error;
      return data as ProcurementRequest;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase createProcurement failed, using mock database:', e);
      return mockDb.createProcurement(procurement);
    }
  },

  receiveProcurement: async (procurementId: string, performedBy: string, status: 'ordered' | 'received'): Promise<ProcurementRequest> => {
    if (!useSupabase()) {
      return mockDb.receiveProcurement(procurementId, performedBy, status);
    }
    try {
      const companyId = await getCompanyId();

      const { data: pr, error: fetchError } = await supabase!
        .from('procurement_requests')
        .select('*')
        .eq('id', procurementId)
        .single();

      if (fetchError) throw fetchError;

      const { data, error } = await supabase!
        .from('procurement_requests')
        .update({ status })
        .eq('id', procurementId)
        .select()
        .single();

      if (error) throw error;

      if (status === 'received') {
        const { data: category } = await supabase!.from('equipment_categories').select('*').eq('id', pr.category_id).single();
        if (category) {
          if (category.item_type === 'reusable') {
            for (let i = 0; i < pr.quantity; i++) {
              // Insert equipment unit (trigger sets code)
              const { data: newEq, error: eqError } = await supabase!
                .from('equipment')
                .insert({
                  company_id: companyId,
                  category_id: pr.category_id,
                  name: pr.description,
                  unit_value_ugx: pr.estimated_cost_ugx / pr.quantity,
                  status: 'available',
                  condition_notes: 'Received via procurement PO.',
                  current_location: 'Kampala Central Warehouse',
                  created_by: performedBy
                })
                .select()
                .single();

              if (eqError) throw eqError;

              // Log transaction
              await supabase!.from('transactions').insert({
                company_id: companyId,
                transaction_type: 'stock_added',
                equipment_id: newEq.id,
                quantity: 1,
                performed_by: performedBy,
                condition_at_event: 'good',
                notes: `Received via procurement PR-${pr.id.substr(0, 4)}`,
                entry_method: 'manual'
              });
            }
          } else {
            // Consumable stock
            // Check if SKU exists already by name
            const { data: existing } = await supabase!
              .from('consumable_stock')
              .select('*')
              .eq('name', pr.description)
              .maybeSingle();

            if (existing) {
              await supabase!
                .from('consumable_stock')
                .update({ quantity_on_hand: existing.quantity_on_hand + pr.quantity })
                .eq('id', existing.id);

              await supabase!.from('transactions').insert({
                company_id: companyId,
                transaction_type: 'stock_added',
                consumable_id: existing.id,
                quantity: pr.quantity,
                performed_by: performedBy,
                notes: `Procured stock received. PR-${pr.id.substr(0, 4)}`,
                entry_method: 'manual'
              });
            } else {
              const { data: newCon, error: conError } = await supabase!
                .from('consumable_stock')
                .insert({
                  company_id: companyId,
                  category_id: pr.category_id,
                  name: pr.description,
                  unit_value_ugx: pr.estimated_cost_ugx / pr.quantity,
                  quantity_on_hand: pr.quantity,
                  reorder_level: 0,
                  created_by: performedBy
                })
                .select()
                .single();

              if (conError) throw conError;

              await supabase!.from('transactions').insert({
                company_id: companyId,
                transaction_type: 'stock_added',
                consumable_id: newCon.id,
                quantity: pr.quantity,
                performed_by: performedBy,
                notes: `Procured stock received. PR-${pr.id.substr(0, 4)}`,
                entry_method: 'manual'
              });
            }
          }
        }
      }

      return data as ProcurementRequest;
    } catch (e) {
      console.warn('Supabase receiveProcurement failed, using mock database:', e);
      return mockDb.receiveProcurement(procurementId, performedBy, status);
    }
  },

  checkOverdueItems: async (): Promise<number> => {
    if (!useSupabase()) {
      return mockDb.checkOverdueItems();
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      // Fetch all fulfilled requests where needed_until < today
      const { data: overdueReqs } = await supabase!
        .from('requests')
        .select('id')
        .eq('status', 'fulfilled')
        .lt('needed_until', today);

      if (!overdueReqs || overdueReqs.length === 0) return 0;
      const reqIds = overdueReqs.map(r => r.id);

      // Find checked out items for these requests
      const { data: items } = await supabase!
        .from('request_items')
        .select('equipment_id')
        .in('request_id', reqIds)
        .not('equipment_id', 'is', null);

      if (!items || items.length === 0) return 0;
      const eqIds = items.map(i => i.equipment_id);

      // Update equipment status
      const { error } = await supabase!
        .from('equipment')
        .update({ status: 'overdue' })
        .in('id', eqIds)
        .eq('status', 'checked_out');

      if (error) throw error;
      return eqIds.length;
    } catch (e) {
      console.warn('Supabase checkOverdueItems failed, using mock database:', e);
      return mockDb.checkOverdueItems();
    }
  },

  updateItemValue: async (id: string, type: 'reusable' | 'consumable', newValue: number): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.updateItemValue(id, type, newValue);
    }
    try {
      const table = type === 'reusable' ? 'equipment' : 'consumable_stock';
      const { error } = await supabase!
        .from(table)
        .update({ unit_value_ugx: newValue })
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase updateItemValue failed, using mock database:', e);
      return mockDb.updateItemValue(id, type, newValue);
    }
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    if (!useSupabase()) {
      return mockDb.getNotifications(userId);
    }
    try {
      const { data, error } = await supabase!
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Notification[];
    } catch (e) {
      console.warn('Supabase getNotifications failed, using mock database:', e);
      return mockDb.getNotifications(userId);
    }
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.markNotificationAsRead(id);
    }
    try {
      const { error } = await supabase!
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase markNotificationAsRead failed, using mock database:', e);
      return mockDb.markNotificationAsRead(id);
    }
  },

  markAllNotificationsAsRead: async (userId: string): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.markAllNotificationsAsRead(userId);
    }
    try {
      const { error } = await supabase!
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase markAllNotificationsAsRead failed, using mock database:', e);
      return mockDb.markAllNotificationsAsRead(userId);
    }
  },

  createNotification: async (companyId: string, userId: string, title: string, message: string, link: string): Promise<Notification> => {
    if (!useSupabase()) {
      return mockDb.createNotification(companyId, userId, title, message, link);
    }
    try {
      const { data, error } = await supabase!
        .from('notifications')
        .insert([{
          company_id: companyId,
          user_id: userId,
          title,
          message,
          link,
          is_read: false
        }])
        .select()
        .single();
      if (error) throw error;
      return data as Notification;
    } catch (e) {
      console.warn('Supabase createNotification failed, using mock database:', e);
      return mockDb.createNotification(companyId, userId, title, message, link);
    }
  },

  getDamageReports: async (): Promise<DamageReport[]> => {
    if (!useSupabase()) {
      return mockDb.getDamageReports();
    }
    try {
      const { data, error } = await supabase!
        .from('damage_reports')
        .select(`
          *,
          equipment:equipment_id (name, asset_code),
          reporter:reported_by (full_name),
          resolver:resolved_by (full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((dr: any) => ({
        ...dr,
        equipment_name: dr.equipment?.name,
        equipment_asset_code: dr.equipment?.asset_code,
        reported_by_name: dr.reporter?.full_name,
        resolved_by_name: dr.resolver?.full_name
      })) as DamageReport[];
    } catch (e) {
      console.warn('Supabase getDamageReports failed, using mock database:', e);
      return mockDb.getDamageReports();
    }
  },

  addDamageReport: async (report: Omit<DamageReport, 'id' | 'company_id' | 'reported_at' | 'status' | 'created_at'>): Promise<DamageReport> => {
    if (!useSupabase()) {
      return mockDb.addDamageReport(report);
    }
    try {
      const companyId = await getCompanyId();

      const { data, error } = await supabase!
        .from('damage_reports')
        .insert([{
          ...report,
          company_id: companyId,
          status: 'open'
        }])
        .select()
        .single();
      if (error) throw error;

      await supabase!
        .from('equipment')
        .update({ damage_report_id: data.id })
        .eq('id', report.equipment_id);

      return data as DamageReport;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase addDamageReport failed, using mock database:', e);
      return mockDb.addDamageReport(report);
    }
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
    if (!useSupabase()) {
      return mockDb.updateDamageReportStatus(id, status, data);
    }
    try {
      const updates: any = { status };
      if (data.estimated_repair_cost_ugx !== undefined) updates.estimated_repair_cost_ugx = data.estimated_repair_cost_ugx;
      if (data.actual_repair_cost_ugx !== undefined) updates.actual_repair_cost_ugx = data.actual_repair_cost_ugx;
      if (data.vendor_name !== undefined) updates.vendor_name = data.vendor_name;
      if (data.resolution_notes !== undefined) updates.resolution_notes = data.resolution_notes;
      if (data.photos !== undefined) updates.photos = data.photos;

      if (status === 'resolved' || status === 'written_off') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = data.resolved_by;
      }

      const { error } = await supabase!
        .from('damage_reports')
        .update(updates)
        .eq('id', id);
      if (error) throw error;

      const { data: drData } = await supabase!
        .from('damage_reports')
        .select('equipment_id, reported_by')
        .eq('id', id)
        .single();

      if (drData) {
        const eqId = drData.equipment_id;
        if (status === 'under_repair') {
          await supabase!.from('equipment').update({ status: 'under_repair', current_location: 'Repair Bay' }).eq('id', eqId);
          await supabase!.from('transactions').insert([{
            transaction_type: 'sent_for_repair',
            equipment_id: eqId,
            quantity: 1,
            performed_by: data.resolved_by || drData.reported_by,
            notes: `Sent to vendor: ${data.vendor_name || 'Generic Vendor'}`,
            entry_method: 'manual'
          }]);
        } else if (status === 'resolved') {
          await supabase!.from('equipment').update({ status: 'available', current_location: 'Kampala Central Warehouse', damage_report_id: null }).eq('id', eqId);
          await supabase!.from('transactions').insert([{
            transaction_type: 'returned_from_repair',
            equipment_id: eqId,
            quantity: 1,
            performed_by: data.resolved_by,
            notes: `Repaired. Cost: ${data.actual_repair_cost_ugx || 0} UGX. Notes: ${data.resolution_notes || ''}`,
            entry_method: 'manual'
          }]);
        } else if (status === 'written_off') {
          await supabase!.from('equipment').update({ status: 'retired', damage_report_id: null }).eq('id', eqId);
          await supabase!.from('transactions').insert([{
            transaction_type: 'retired',
            equipment_id: eqId,
            quantity: 1,
            performed_by: data.resolved_by,
            notes: `Written off - uneconomical to repair. Damage report #${id}`,
            entry_method: 'manual'
          }]);

          const { data: wms } = await supabase!.from('users').select('id').eq('role', 'warehouse_manager');
          if (wms) {
            const companyId = await getCompanyId();
            const { data: eqCode } = await supabase!.from('equipment').select('asset_code').eq('id', eqId).single();
            const inserts = wms.map((wm: any) => ({
              company_id: companyId,
              user_id: wm.id,
              title: 'Asset Written Off',
              message: `Asset ${eqCode?.asset_code || '—'} written off by CFO. Damage report #${id} closed.`,
              link: '/damage-reports',
              is_read: false
            }));
            await supabase!.from('notifications').insert(inserts);
          }
        }
      }
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase updateDamageReportStatus failed, using mock database:', e);
      return mockDb.updateDamageReportStatus(id, status, data);
    }
  },

  getGRNDocuments: async (): Promise<GrnDocument[]> => {
    if (!useSupabase()) {
      return mockDb.getGRNDocuments();
    }
    try {
      const { data, error } = await supabase!
        .from('grn_documents')
        .select(`
          *,
          receiver:received_by (full_name),
          items:grn_items (quantity_received, unit_value_ugx)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map((doc: any) => {
        const count = doc.items?.length || 0;
        const total = doc.items?.reduce((sum: number, it: any) => sum + (parseFloat(it.quantity_received) * parseFloat(it.unit_value_ugx)), 0) || 0;
        return {
          ...doc,
          received_by_name: doc.receiver?.full_name,
          items_count: count,
          total_value: total
        };
      }) as GrnDocument[];
    } catch (e) {
      console.warn('Supabase getGRNDocuments failed, using mock database:', e);
      return mockDb.getGRNDocuments();
    }
  },

  getGRNItems: async (grnId: string): Promise<GrnItem[]> => {
    if (!useSupabase()) {
      return mockDb.getGRNItems(grnId);
    }
    try {
      const { data, error } = await supabase!
        .from('grn_items')
        .select(`
          *,
          equipment:equipment_id (name, asset_code),
          consumable:consumable_id (name, sku_code)
        `)
        .eq('grn_id', grnId);
      if (error) throw error;

      return (data || []).map((it: any) => ({
        ...it,
        item_name: it.equipment?.name || it.consumable?.name || '',
        item_code: it.equipment?.asset_code || it.consumable?.sku_code || '—'
      })) as GrnItem[];
    } catch (e) {
      console.warn('Supabase getGRNItems failed, using mock database:', e);
      return mockDb.getGRNItems(grnId);
    }
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
    if (!useSupabase()) {
      return mockDb.createGRNDocument(doc, items);
    }
    return mockDb.createGRNDocument(doc, items);
  },

  getNotificationChannels: async (): Promise<NotificationChannel[]> => {
    if (!useSupabase()) {
      return mockDb.getNotificationChannels();
    }
    try {
      const { data, error } = await supabase!
        .from('notification_channels')
        .select('*');
      if (error) throw error;
      return data as NotificationChannel[];
    } catch (e) {
      console.warn('Supabase getNotificationChannels failed, using mock database:', e);
      return mockDb.getNotificationChannels();
    }
  },

  saveNotificationChannel: async (channel: Omit<NotificationChannel, 'id' | 'updated_at'>): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.saveNotificationChannel(channel);
    }
    try {
      const { error } = await supabase!
        .from('notification_channels')
        .upsert({
          user_id: channel.user_id,
          whatsapp_number: channel.whatsapp_number,
          email_enabled: channel.email_enabled,
          preferred_channel: channel.preferred_channel,
          is_active: channel.is_active,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase saveNotificationChannel failed, using mock database:', e);
      return mockDb.saveNotificationChannel(channel);
    }
  },

  getQrLabelByCode: async (code: string): Promise<QrLabel | null> => {
    if (!useSupabase()) {
      return mockDb.getQrLabelByCode(code);
    }
    try {
      const { data, error } = await supabase!
        .from('qr_labels')
        .select('*')
        .eq('label_code', code)
        .maybeSingle();
      if (error) throw error;
      return data as QrLabel | null;
    } catch (e) {
      console.warn('Supabase getQrLabelByCode failed, using mock database:', e);
      return mockDb.getQrLabelByCode(code);
    }
  },

  generateQrLabel: async (target: { equipment_id?: string; consumable_id?: string; company_id: string; generated_by: string }): Promise<QrLabel> => {
    if (!useSupabase()) {
      return mockDb.generateQrLabel(target);
    }
    try {
      const label_code = target.equipment_id ? `EQPT:${target.equipment_id}` : `CONS:${target.consumable_id}`;
      // Check if it already exists to prevent duplicate insertion
      const { data: existing } = await supabase!
        .from('qr_labels')
        .select('*')
        .eq('label_code', label_code)
        .maybeSingle();
      
      if (existing) return existing as QrLabel;

      const { data: newLabel, error } = await supabase!
        .from('qr_labels')
        .insert([{
          company_id: target.company_id,
          equipment_id: target.equipment_id,
          consumable_id: target.consumable_id,
          label_code,
          generated_by: target.generated_by
        }])
        .select()
        .single();
      
      if (error) throw error;

      // Update equipment/consumable table reference
      if (target.equipment_id) {
        await supabase!
          .from('equipment')
          .update({ qr_label_id: newLabel.id })
          .eq('id', target.equipment_id);
      } else if (target.consumable_id) {
        await supabase!
          .from('consumable_stock')
          .update({ qr_label_id: newLabel.id })
          .eq('id', target.consumable_id);
      }

      return newLabel as QrLabel;
    } catch (e) {
      console.warn('Supabase generateQrLabel failed, using mock database:', e);
      return mockDb.generateQrLabel(target);
    }
  },

  markQrLabelPrinted: async (labelId: string): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.markQrLabelPrinted(labelId);
    }
    try {
      const { error } = await supabase!
        .from('qr_labels')
        .update({ printed_at: new Date().toISOString() })
        .eq('id', labelId);
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase markQrLabelPrinted failed, using mock database:', e);
      return mockDb.markQrLabelPrinted(labelId);
    }
  },

  getReportExports: async (): Promise<ReportExport[]> => {
    if (!useSupabase()) {
      return mockDb.getReportExports();
    }
    try {
      const { data, error } = await supabase!
        .from('report_exports')
        .select(`
          *,
          generated_by_user:users!report_exports_generated_by_fkey (full_name)
        `)
        .order('generated_at', { ascending: false });
      
      if (error) throw error;

      return data.map((re: any) => ({
        ...re,
        generated_by_name: re.generated_by_user ? re.generated_by_user.full_name : 'System'
      })) as ReportExport[];
    } catch (e) {
      console.warn('Supabase getReportExports failed, using mock database:', e);
      return mockDb.getReportExports();
    }
  },

  createReportExport: async (exportData: Omit<ReportExport, 'id' | 'generated_at'>): Promise<ReportExport> => {
    if (!useSupabase()) {
      return mockDb.createReportExport(exportData);
    }
    try {
      const { data, error } = await supabase!
        .from('report_exports')
        .insert([{
          company_id: exportData.company_id,
          report_type: exportData.report_type,
          generated_by: exportData.generated_by,
          date_from: exportData.date_from,
          date_to: exportData.date_to,
          format: exportData.format,
          file_url: exportData.file_url,
          expires_at: exportData.expires_at
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Fetch user name helper
      const { data: usr } = await supabase!.from('users').select('full_name').eq('id', exportData.generated_by).single();

      return {
        ...data,
        generated_by_name: usr ? usr.full_name : 'System'
      } as ReportExport;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase createReportExport failed, using mock database:', e);
      return mockDb.createReportExport(exportData);
    }
  },

  getCashAdvances: async (role: User['role'], userId: string): Promise<CashAdvance[]> => {
    if (!useSupabase()) {
      return mockDb.getCashAdvances(role, userId);
    }
    try {
      const companyId = await getCompanyId();
      
      let query = supabase!
        .from('cash_advances')
        .select(`
          *,
          users:requested_by (full_name),
          advance_disbursements (amount_ugx),
          retirement_entries (amount_ugx)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (role === 'pm' || role === 'coordinator') {
        query = query.eq('requested_by', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map((adv: any) => {
        const amount_disbursed_ugx = adv.advance_disbursements?.amount_ugx ? Number(adv.advance_disbursements.amount_ugx) : 0;
        const amount_retired_ugx = adv.retirement_entries?.reduce((sum: number, r: any) => sum + Number(r.amount_ugx), 0) || 0;
        const outstanding_ugx = Math.max(0, amount_disbursed_ugx - amount_retired_ugx);

        return {
          ...adv,
          requested_by_name: adv.users ? adv.users.full_name : 'PM Operator',
          amount_disbursed_ugx,
          amount_retired_ugx,
          outstanding_ugx
        } as CashAdvance;
      });
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase getCashAdvances failed, using mock database:', e);
      return mockDb.getCashAdvances(role, userId);
    }
  },

  requestCashAdvance: async (
    advance: Omit<CashAdvance, 'id' | 'company_id' | 'status' | 'created_at'>
  ): Promise<CashAdvance> => {
    if (!useSupabase()) {
      return mockDb.requestCashAdvance(advance);
    }
    try {
      const { data: advanceId, error } = await supabase!.rpc('rpc_request_cash_advance', {
        p_project_name: advance.project_name,
        p_purpose: advance.purpose,
        p_amount_requested_ugx: advance.amount_requested_ugx,
        p_expected_retirement_date: advance.expected_retirement_date
      });

      if (error) throw error;

      const { data: newAdv, error: fetchError } = await supabase!
        .from('cash_advances')
        .select(`
          *,
          users:requested_by (full_name)
        `)
        .eq('id', advanceId)
        .single();

      if (fetchError) throw fetchError;

      return {
        ...newAdv,
        requested_by_name: newAdv.users ? newAdv.users.full_name : 'PM Operator',
        amount_disbursed_ugx: 0,
        amount_retired_ugx: 0,
        outstanding_ugx: 0
      } as CashAdvance;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase requestCashAdvance failed, using mock database:', e);
      return mockDb.requestCashAdvance(advance);
    }
  },

  approveCashAdvance: async (id: string, approverId: string): Promise<CashAdvance> => {
    if (!useSupabase()) {
      return mockDb.approveCashAdvance(id, approverId);
    }
    try {
      const { data, error } = await supabase!
        .from('cash_advances')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CashAdvance;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase approveCashAdvance failed, using mock database:', e);
      return mockDb.approveCashAdvance(id, approverId);
    }
  },

  rejectCashAdvance: async (id: string, approverId: string, reason: string): Promise<CashAdvance> => {
    if (!useSupabase()) {
      return mockDb.rejectCashAdvance(id, approverId, reason);
    }
    try {
      const { data, error } = await supabase!
        .from('cash_advances')
        .update({
          status: 'rejected',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CashAdvance;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase rejectCashAdvance failed, using mock database:', e);
      return mockDb.rejectCashAdvance(id, approverId, reason);
    }
  },

  disburseAdvance: async (
    disb: Omit<Disbursement, 'id' | 'company_id' | 'created_at' | 'disbursed_at'>
  ): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.disburseAdvance(disb);
    }
    try {
      const { error } = await supabase!.rpc('rpc_disburse_advance', {
        p_advance_id: disb.advance_id,
        p_method: disb.method,
        p_amount_ugx: disb.amount_ugx,
        p_bank_reference: disb.bank_reference || null,
        p_bank_account: disb.bank_account || null,
        p_witness_name: disb.witness_name || null,
        p_signed_proof_url: disb.signed_proof_url || null
      });

      if (error) throw error;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase disburseAdvance failed, using mock database:', e);
      return mockDb.disburseAdvance(disb);
    }
  },

  submitRetirementEntry: async (
    entry: Omit<RetirementEntry, 'id' | 'company_id' | 'created_at'>
  ): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.submitRetirementEntry(entry);
    }
    try {
      const { error } = await supabase!.rpc('rpc_submit_retirement_entry', {
        p_advance_id: entry.advance_id,
        p_category: entry.category,
        p_description: entry.description,
        p_amount_ugx: entry.amount_ugx,
        p_entry_date: entry.entry_date,
        p_receipt_photo_url: entry.receipt_photo_url
      });

      if (error) throw error;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase submitRetirementEntry failed, using mock database:', e);
      return mockDb.submitRetirementEntry(entry);
    }
  },

  getRetirementEntries: async (advanceId: string): Promise<RetirementEntry[]> => {
    if (!useSupabase()) {
      return mockDb.getRetirementEntries(advanceId);
    }
    try {
      const { data, error } = await supabase!
        .from('retirement_entries')
        .select('*')
        .eq('advance_id', advanceId)
        .order('entry_date', { ascending: true });

      if (error) throw error;
      return data as RetirementEntry[];
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase getRetirementEntries failed, using mock database:', e);
      return mockDb.getRetirementEntries(advanceId);
    }
  },

  checkOverdueAdvances: async (): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.checkOverdueAdvances();
    }
    try {
      const { error } = await supabase!.rpc('rpc_check_overdue_advances');
      if (error) throw error;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase checkOverdueAdvances failed, using mock database:', e);
      return mockDb.checkOverdueAdvances();
    }
  },

  getProjects: async (): Promise<Project[]> => {
    if (!useSupabase()) {
      return mockDb.getProjects();
    }
    try {
      const { data, error } = await supabase!
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase getProjects failed, using mock database:', e);
      return mockDb.getProjects();
    }
  },

  createProject: async (project: Omit<Project, 'id' | 'company_id' | 'created_at'>): Promise<Project> => {
    if (!useSupabase()) {
      return mockDb.createProject(project);
    }
    try {
      const companyId = await getCompanyId();
      const { data, error } = await supabase!
        .from('projects')
        .insert([{
          ...project,
          company_id: companyId
        }])
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase createProject failed, using mock database:', e);
      return mockDb.createProject(project);
    }
  },

  updateProjectBudget: async (projectId: string, budget: number, notes: string, userId: string): Promise<Project> => {
    if (!useSupabase()) {
      return mockDb.updateProjectBudget(projectId, budget, notes, userId);
    }
    try {
      const { data, error } = await supabase!
        .from('projects')
        .update({
          estimated_budget_ugx: budget,
          budget_notes: notes,
          budget_set_by: userId
        })
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase updateProjectBudget failed, using mock database:', e);
      return mockDb.updateProjectBudget(projectId, budget, notes, userId);
    }
  },

  updateProjectStatus: async (projectId: string, status: 'active' | 'completed' | 'on_hold'): Promise<Project> => {
    if (!useSupabase()) {
      return mockDb.updateProjectStatus(projectId, status);
    }
    try {
      const { data, error } = await supabase!
        .from('projects')
        .update({ status })
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase updateProjectStatus failed, using mock database:', e);
      return mockDb.updateProjectStatus(projectId, status);
    }
  },

  getProjectAssignments: async (): Promise<ProjectAssignment[]> => {
    if (!useSupabase()) {
      return mockDb.getProjectAssignments();
    }
    try {
      const { data, error } = await supabase!
        .from('project_assignments')
        .select('*');
      if (error) throw error;
      return data as ProjectAssignment[];
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase getProjectAssignments failed, using mock database:', e);
      return mockDb.getProjectAssignments();
    }
  },

  assignUserToProject: async (projectId: string, userId: string, roleOnProject: 'coordinator' | 'pm'): Promise<ProjectAssignment> => {
    if (!useSupabase()) {
      return mockDb.assignUserToProject(projectId, userId, roleOnProject);
    }
    try {
      const companyId = await getCompanyId();
      const { data, error } = await supabase!
        .from('project_assignments')
        .insert([{
          company_id: companyId,
          project_id: projectId,
          user_id: userId,
          role_on_project: roleOnProject
        }])
        .select()
        .single();
      if (error) throw error;
      return data as ProjectAssignment;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase assignUserToProject failed, using mock database:', e);
      return mockDb.assignUserToProject(projectId, userId, roleOnProject);
    }
  },

  unassignUserFromProject: async (assignmentId: string): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.unassignUserFromProject(assignmentId);
    }
    try {
      const { error } = await supabase!
        .from('project_assignments')
        .update({ unassigned_at: new Date().toISOString() })
        .eq('id', assignmentId);
      if (error) throw error;
    } catch (e: any) {
      if (useSupabase()) throw e;
      console.warn('Supabase unassignUserFromProject failed, using mock database:', e);
      return mockDb.unassignUserFromProject(assignmentId);
    }
  }
};
