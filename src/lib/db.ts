// Unified Database Client for Egypro EquipTrack (Phase One)
// Delegates queries to Supabase if configured, or falls back to Mock LocalStorage.

import { supabase } from './supabaseClient';
import { mockDb, User, Category, Equipment, ConsumableStock, Request, Transaction, ProcurementRequest, Settings, RequestItem, Notification } from './mockDb';

export type { User, Category, Equipment, ConsumableStock, Request, Transaction, ProcurementRequest, Settings, RequestItem, Notification };

// Helper to determine if we should use Supabase or fallback to mock
const useSupabase = () => {
  return supabase !== null;
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

  addUser: async (user: Omit<User, 'id' | 'company_id' | 'is_active' | 'created_at'>): Promise<User> => {
    if (!useSupabase()) {
      return mockDb.addUser(user);
    }
    try {
      // Create user in the database users table.
      // Note: In Supabase, the CFO creates a user by first registering them in Auth (e.g. via edge functions or client-side SignUp),
      // and then inserting into the users table. For simplicity in Phase One client, we insert a record.
      // We generate a UUID since auth.users is managed by Supabase.
      const { data: companyData } = await supabase!.from('companies').select('id').limit(1).single();
      const companyId = companyData?.id;

      const newUser = {
        id: crypto.randomUUID(),
        company_id: companyId,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone || null,
        is_active: true
      };

      const { data, error } = await supabase!
        .from('users')
        .insert(newUser)
        .select()
        .single();
      if (error) throw error;
      return data as User;
    } catch (e) {
      console.warn('Supabase addUser failed, using mock database:', e);
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
      const { data: companyData } = await supabase!.from('companies').select('id').limit(1).single();
      const { data, error } = await supabase!
        .from('equipment_categories')
        .insert({
          company_id: companyData?.id,
          name: category.name,
          code_prefix: category.code_prefix,
          item_type: category.item_type
        })
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    } catch (e) {
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
    } catch (e) {
      console.warn('Supabase getEquipment failed, using mock database:', e);
      return mockDb.getEquipment();
    }
  },

  addEquipment: async (item: Omit<Equipment, 'id' | 'company_id' | 'asset_code' | 'created_at' | 'status'>, quantity: number = 1): Promise<Equipment[]> => {
    if (!useSupabase()) {
      return mockDb.addEquipment(item, quantity);
    }
    try {
      const { data: companyData } = await supabase!.from('companies').select('id').limit(1).single();
      const companyId = companyData?.id;

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
    } catch (e) {
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
    } catch (e) {
      console.warn('Supabase getConsumables failed, using mock database:', e);
      return mockDb.getConsumables();
    }
  },

  addConsumable: async (item: Omit<ConsumableStock, 'id' | 'company_id' | 'sku_code' | 'created_at'>): Promise<ConsumableStock> => {
    if (!useSupabase()) {
      return mockDb.addConsumable(item);
    }
    try {
      const { data: companyData } = await supabase!.from('companies').select('id').limit(1).single();
      const companyId = companyData?.id;

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

      return newCon;
    } catch (e) {
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
      const { data: companyData } = await supabase!.from('companies').select('id').limit(1).single();
      const companyId = companyData?.id;

      // Determine routing logic by fetching settings and items
      const { data: settings } = await supabase!.from('settings').select('approval_threshold_ugx').limit(1).single();
      const threshold = settings?.approval_threshold_ugx || 500000;
      let routesToCfo = false;

      // Check each item
      for (const item of items) {
        if (item.equipment_id) {
          const { data: eq } = await supabase!.from('equipment').select('*').eq('id', item.equipment_id).single();
          if (!eq || eq.unit_value_ugx >= threshold || eq.status !== 'available') {
            routesToCfo = true;
          }
          // Check if leaves at least 1 unit remaining in stock of same model
          if (eq) {
            const { count } = await supabase!
              .from('equipment')
              .select('*', { count: 'exact', head: true })
              .eq('name', eq.name)
              .eq('status', 'available');
            if (count === null || count <= 1) {
              routesToCfo = true;
            }
          }
        } else if (item.consumable_id) {
          const { data: con } = await supabase!.from('consumable_stock').select('*').eq('id', item.consumable_id).single();
          if (!con || con.unit_value_ugx >= threshold || con.quantity_on_hand < item.quantity_requested || con.quantity_on_hand - item.quantity_requested < 1) {
            routesToCfo = true;
          }
        }
      }

      // Insert request
      const { data: newRequest, error } = await supabase!
        .from('requests')
        .insert({
          company_id: companyId,
          requested_by: request.requested_by,
          project_name: request.project_name,
          site_location: request.site_location || null,
          needed_from: request.needed_from,
          needed_until: request.needed_until || null,
          status: 'pending',
          routed_to: routesToCfo ? 'cfo' : 'warehouse_manager'
        })
        .select()
        .single();

      if (error) throw error;

      // Insert request items
      const itemsToInsert = items.map(it => ({
        request_id: newRequest.id,
        equipment_id: it.equipment_id || null,
        consumable_id: it.consumable_id || null,
        quantity_requested: it.quantity_requested
      }));

      const { error: itemsError } = await supabase!.from('request_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      return newRequest as Request;
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
      console.warn('Supabase rejectRequest failed, using mock database:', e);
      return mockDb.rejectRequest(requestId, approverId, reason);
    }
  },

  checkoutRequest: async (requestId: string, performedBy: string): Promise<Request> => {
    if (!useSupabase()) {
      return mockDb.checkoutRequest(requestId, performedBy);
    }
    try {
      // 1. Fetch request details and items
      const { data: req } = await supabase!.from('requests').select('*').eq('id', requestId).single();
      const { data: items } = await supabase!.from('request_items').select('*').eq('request_id', requestId);

      if (!req || !items) throw new Error('Request or items not found');

      // 2. Transact items
      for (const item of items) {
        if (item.equipment_id) {
          // Reusable - Set status to checked_out
          await supabase!
            .from('equipment')
            .update({ status: 'checked_out', current_location: req.site_location || 'Field Site' })
            .eq('id', item.equipment_id);

          // Log transaction
          await supabase!.from('transactions').insert({
            company_id: req.company_id,
            transaction_type: 'checkout',
            equipment_id: item.equipment_id,
            request_id: requestId,
            quantity: 1,
            performed_by: performedBy,
            counterparty: req.requested_by,
            notes: `Checked out for project: ${req.project_name}`,
            entry_method: 'manual'
          });
        } else if (item.consumable_id) {
          // Consumable - Decrement stock quantity
          const { data: con } = await supabase!.from('consumable_stock').select('quantity_on_hand').eq('id', item.consumable_id).single();
          if (con) {
            const newQty = Math.max(0, con.quantity_on_hand - item.quantity_requested);
            await supabase!
              .from('consumable_stock')
              .update({ quantity_on_hand: newQty })
              .eq('id', item.consumable_id);

            // Log transaction
            await supabase!.from('transactions').insert({
              company_id: req.company_id,
              transaction_type: 'stock_consumed',
              consumable_id: item.consumable_id,
              request_id: requestId,
              quantity: item.quantity_requested,
              performed_by: performedBy,
              counterparty: req.requested_by,
              notes: `Consumed for project: ${req.project_name}`,
              entry_method: 'manual'
            });
          }
        }
      }

      // 3. Mark request as fulfilled
      const { data, error } = await supabase!
        .from('requests')
        .update({ status: 'fulfilled' })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data as Request;
    } catch (e) {
      console.warn('Supabase checkoutRequest failed, using mock database:', e);
      return mockDb.checkoutRequest(requestId, performedBy);
    }
  },

  returnRequestItem: async (
    requestId: string,
    equipmentId: string,
    condition: 'good' | 'damaged' | 'missing_parts' | 'non_functional',
    notes: string,
    performedBy: string
  ): Promise<void> => {
    if (!useSupabase()) {
      return mockDb.returnRequestItem(requestId, equipmentId, condition, notes, performedBy);
    }
    try {
      const { data: req } = await supabase!.from('requests').select('*').eq('id', requestId).single();
      if (!req) throw new Error('Request not found');

      // Update equipment status
      const eqStatus = condition === 'good' ? 'available' : 'under_repair';
      const eqLoc = condition === 'good' ? 'Kampala Central Warehouse' : 'Repair Bay';
      
      const { data: eq } = await supabase!.from('equipment').select('condition_notes').eq('id', equipmentId).single();
      const updatedNotes = notes ? `${notes} (Logged during return)` : `Logged as ${condition} during return.`;

      await supabase!
        .from('equipment')
        .update({
          status: eqStatus,
          current_location: eqLoc,
          condition_notes: updatedNotes
        })
        .eq('id', equipmentId);

      // Log transaction
      await supabase!.from('transactions').insert({
        company_id: req.company_id,
        transaction_type: 'return',
        equipment_id: equipmentId,
        request_id: requestId,
        quantity: 1,
        performed_by: performedBy,
        counterparty: req.requested_by,
        condition_at_event: condition,
        notes: notes || `Returned condition: ${condition}`,
        entry_method: 'manual'
      });

      // Check if all reusable items in this request have been returned
      const { data: items } = await supabase!.from('request_items').select('equipment_id').eq('request_id', requestId);
      const reusableEqIds = items?.filter(i => i.equipment_id).map(i => i.equipment_id) || [];

      if (reusableEqIds.length > 0) {
        // Count how many are still checked_out
        const { count } = await supabase!
          .from('equipment')
          .select('*', { count: 'exact', head: true })
          .in('id', reusableEqIds)
          .eq('status', 'checked_out');

        if (count === 0) {
          // Mark request returned
          await supabase!.from('requests').update({ status: 'returned' }).eq('id', requestId);
        }
      }
    } catch (e) {
      console.warn('Supabase returnRequestItem failed, using mock database:', e);
      return mockDb.returnRequestItem(requestId, equipmentId, condition, notes, performedBy);
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
      const { data: companyData } = await supabase!.from('companies').select('id').limit(1).single();
      const companyId = companyData?.id;

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
    } catch (e) {
      console.warn('Supabase createProcurement failed, using mock database:', e);
      return mockDb.createProcurement(procurement);
    }
  },

  receiveProcurement: async (procurementId: string, performedBy: string, status: 'ordered' | 'received'): Promise<ProcurementRequest> => {
    if (!useSupabase()) {
      return mockDb.receiveProcurement(procurementId, performedBy, status);
    }
    try {
      const { data: companyData } = await supabase!.from('companies').select('id').limit(1).single();
      const companyId = companyData?.id;

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
  }
};
