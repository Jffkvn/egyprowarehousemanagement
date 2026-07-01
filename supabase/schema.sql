-- Supabase Database Schema for Egypro EquipTrack (Phase One)

-- 1. ENUMS AND TYPES
CREATE TYPE user_role AS ENUM ('pm', 'warehouse_manager', 'cfo');
CREATE TYPE category_item_type AS ENUM ('reusable', 'consumable');
CREATE TYPE equipment_status AS ENUM ('available', 'checked_out', 'overdue', 'under_repair', 'retired', 'pending_inspection');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'fulfilled', 'returned', 'cancelled');
CREATE TYPE route_target AS ENUM ('warehouse_manager', 'cfo');
CREATE TYPE transaction_type_enum AS ENUM ('checkout', 'return', 'stock_added', 'stock_consumed', 'retired', 'sent_for_repair', 'returned_from_repair');
CREATE TYPE condition_type AS ENUM ('good', 'damaged', 'missing_parts', 'non_functional');
CREATE TYPE procurement_status_enum AS ENUM ('requested', 'ordered', 'received');

-- 2. TABLES

-- Companies (Single-tenant for now, but structures exist for multi-tenant support)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (Profiles linked to Supabase Auth users)
CREATE TABLE users (
  id UUID PRIMARY KEY, -- Will correspond to auth.users.id
  company_id UUID NOT NULL REFERENCES companies(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Settings Table (Holds company global thresholds, e.g. approval threshold)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
  approval_threshold_ugx NUMERIC NOT NULL DEFAULT 500000 CHECK (approval_threshold_ugx >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

-- Categories
CREATE TABLE equipment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  code_prefix TEXT NOT NULL,
  item_type category_item_type NOT NULL,
  UNIQUE (company_id, code_prefix),
  UNIQUE (company_id, name)
);

-- Reusable Equipment (One row per physical unit)
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  category_id UUID NOT NULL REFERENCES equipment_categories(id),
  name TEXT NOT NULL,
  asset_code TEXT NOT NULL UNIQUE,
  manufacturer_serial TEXT,
  unit_value_ugx NUMERIC NOT NULL CHECK (unit_value_ugx >= 0),
  status equipment_status NOT NULL DEFAULT 'available',
  condition_notes TEXT,
  current_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- Consumable Stock (One row per SKU with running count)
CREATE TABLE consumable_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  category_id UUID NOT NULL REFERENCES equipment_categories(id),
  name TEXT NOT NULL,
  sku_code TEXT NOT NULL UNIQUE,
  unit_value_ugx NUMERIC NOT NULL CHECK (unit_value_ugx >= 0),
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level NUMERIC NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- Requests Table
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  project_name TEXT NOT NULL,
  site_location TEXT,
  needed_from DATE NOT NULL,
  needed_until DATE,
  status request_status NOT NULL DEFAULT 'pending',
  routed_to route_target NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Request Items Table
CREATE TABLE request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id),
  consumable_id UUID REFERENCES consumable_stock(id),
  quantity_requested NUMERIC NOT NULL CHECK (quantity_requested > 0),
  CONSTRAINT one_item_type CHECK (
    (equipment_id IS NOT NULL AND consumable_id IS NULL) OR
    (equipment_id IS NULL AND consumable_id IS NOT NULL)
  )
);

-- Transactions Table (Append-only)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  transaction_type transaction_type_enum NOT NULL,
  equipment_id UUID REFERENCES equipment(id),
  consumable_id UUID REFERENCES consumable_stock(id),
  request_id UUID REFERENCES requests(id),
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  performed_by UUID NOT NULL REFERENCES users(id),
  counterparty UUID REFERENCES users(id),
  condition_at_event condition_type,
  notes TEXT,
  entry_method TEXT NOT NULL DEFAULT 'manual' CHECK (entry_method = 'manual'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Procurement Requests Table
CREATE TABLE procurement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  category_id UUID NOT NULL REFERENCES equipment_categories(id),
  description TEXT NOT NULL,
  estimated_cost_ugx NUMERIC NOT NULL CHECK (estimated_cost_ugx >= 0),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  status procurement_status_enum NOT NULL DEFAULT 'requested',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. AUTOMATIC ASSET/SKU CODE GENERATION

-- Sequence table to safely track values and avoid locks/collisions
CREATE TABLE category_sequences (
  company_id UUID NOT NULL REFERENCES companies(id),
  category_id UUID NOT NULL REFERENCES equipment_categories(id),
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, category_id)
);

-- Function to generate next code and update sequence
CREATE OR REPLACE FUNCTION generate_next_category_code()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_seq INTEGER;
  v_company_id UUID;
  v_category_id UUID;
BEGIN
  v_company_id := NEW.company_id;
  v_category_id := NEW.category_id;

  -- Get code prefix
  SELECT code_prefix INTO v_prefix
  FROM equipment_categories
  WHERE id = v_category_id;

  -- Insert sequence tracker if not exists and lock row for update to prevent race conditions
  INSERT INTO category_sequences (company_id, category_id, last_value)
  VALUES (v_company_id, v_category_id, 0)
  ON CONFLICT (company_id, category_id) DO NOTHING;

  UPDATE category_sequences
  SET last_value = last_value + 1
  WHERE company_id = v_company_id AND category_id = v_category_id
  RETURNING last_value INTO v_seq;

  -- Assign code based on table
  IF TG_TABLE_NAME = 'equipment' THEN
    NEW.asset_code := v_prefix || '-' || LPAD(v_seq::text, 4, '0');
  ELSIF TG_TABLE_NAME = 'consumable_stock' THEN
    NEW.sku_code := v_prefix || '-' || LPAD(v_seq::text, 4, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set up triggers
CREATE TRIGGER trigger_generate_asset_code
BEFORE INSERT ON equipment
FOR EACH ROW
WHEN (NEW.asset_code IS NULL OR NEW.asset_code = '')
EXECUTE FUNCTION generate_next_category_code();

CREATE TRIGGER trigger_generate_sku_code
BEFORE INSERT ON consumable_stock
FOR EACH ROW
WHEN (NEW.sku_code IS NULL OR NEW.sku_code = '')
EXECUTE FUNCTION generate_next_category_code();

-- 4. ROW-LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumable_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;

-- Helper function to check role of current authenticated user
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_current_user_company()
RETURNS UUID AS $$
  SELECT company_id FROM users WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS: Companies
CREATE POLICY company_access ON companies
  FOR SELECT USING (id = get_current_user_company());

-- RLS: Users
CREATE POLICY users_select ON users
  FOR SELECT USING (company_id = get_current_user_company());

CREATE POLICY users_insert_cfo ON users
  FOR INSERT WITH CHECK (get_current_user_role() = 'cfo');

CREATE POLICY users_update_cfo ON users
  FOR UPDATE USING (get_current_user_role() = 'cfo') WITH CHECK (get_current_user_role() = 'cfo');

-- RLS: Settings
CREATE POLICY settings_select ON settings
  FOR SELECT USING (company_id = get_current_user_company());

CREATE POLICY settings_all_cfo ON settings
  FOR ALL USING (get_current_user_role() = 'cfo') WITH CHECK (get_current_user_role() = 'cfo');

-- RLS: Equipment Categories
CREATE POLICY categories_select ON equipment_categories
  FOR SELECT USING (company_id = get_current_user_company());

CREATE POLICY categories_write_wm_cfo ON equipment_categories
  FOR ALL USING (get_current_user_role() IN ('warehouse_manager', 'cfo'))
  WITH CHECK (get_current_user_role() IN ('warehouse_manager', 'cfo'));

-- RLS: Equipment
CREATE POLICY equipment_select ON equipment
  FOR SELECT USING (company_id = get_current_user_company());

CREATE POLICY equipment_write_wm_cfo ON equipment
  FOR ALL USING (get_current_user_role() IN ('warehouse_manager', 'cfo'))
  WITH CHECK (get_current_user_role() IN ('warehouse_manager', 'cfo'));

-- RLS: Consumable Stock
CREATE POLICY consumables_select ON consumable_stock
  FOR SELECT USING (company_id = get_current_user_company());

CREATE POLICY consumables_write_wm_cfo ON consumable_stock
  FOR ALL USING (get_current_user_role() IN ('warehouse_manager', 'cfo'))
  WITH CHECK (get_current_user_role() IN ('warehouse_manager', 'cfo'));

-- RLS: Requests
CREATE POLICY requests_select_all_wm_cfo ON requests
  FOR SELECT USING (
    company_id = get_current_user_company() AND 
    get_current_user_role() IN ('warehouse_manager', 'cfo')
  );

CREATE POLICY requests_select_own_pm ON requests
  FOR SELECT USING (
    company_id = get_current_user_company() AND 
    requested_by = auth.uid()
  );

CREATE POLICY requests_insert_pm ON requests
  FOR INSERT WITH CHECK (
    company_id = get_current_user_company() AND 
    requested_by = auth.uid() AND 
    get_current_user_role() = 'pm'
  );

CREATE POLICY requests_update_approver_wm ON requests
  FOR UPDATE USING (
    company_id = get_current_user_company() AND 
    (
      (get_current_user_role() = 'warehouse_manager' AND routed_to = 'warehouse_manager') OR
      (get_current_user_role() = 'cfo')
    )
  );

-- RLS: Request Items
CREATE POLICY request_items_select ON request_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM requests r 
      WHERE r.id = request_items.request_id AND 
      (r.requested_by = auth.uid() OR get_current_user_role() IN ('warehouse_manager', 'cfo'))
    )
  );

CREATE POLICY request_items_insert ON request_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r 
      WHERE r.id = request_items.request_id AND 
      r.requested_by = auth.uid() AND 
      get_current_user_role() = 'pm'
    )
  );

-- RLS: Transactions (Append-Only)
CREATE POLICY transactions_select ON transactions
  FOR SELECT USING (company_id = get_current_user_company());

CREATE POLICY transactions_insert ON transactions
  FOR INSERT WITH CHECK (
    company_id = get_current_user_company() AND 
    performed_by = auth.uid() AND 
    get_current_user_role() IN ('warehouse_manager', 'cfo')
  );

-- RLS: Procurement Requests
CREATE POLICY procurement_select_all ON procurement_requests
  FOR SELECT USING (company_id = get_current_user_company());

CREATE POLICY procurement_insert_cfo ON procurement_requests
  FOR INSERT WITH CHECK (
    company_id = get_current_user_company() AND
    created_by = auth.uid() AND
    get_current_user_role() = 'cfo'
  );

CREATE POLICY procurement_update_status_wm ON procurement_requests
  FOR UPDATE USING (
    company_id = get_current_user_company() AND
    get_current_user_role() = 'warehouse_manager'
  );

-- 5. INITIAL SEEDING HELPERS

-- A function to seed the initial single tenant company and settings.
-- This can be run in Supabase.
CREATE OR REPLACE FUNCTION seed_initial_company(p_company_name TEXT)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  INSERT INTO companies (name)
  VALUES (p_company_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_company_id;

  INSERT INTO settings (company_id, approval_threshold_ugx)
  VALUES (v_company_id, 500000)
  ON CONFLICT (company_id) DO NOTHING;

  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql;
