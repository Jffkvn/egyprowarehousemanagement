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

CREATE POLICY equipment_insert_wm_cfo ON equipment
  FOR INSERT WITH CHECK (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

CREATE POLICY equipment_update_wm_cfo ON equipment
  FOR UPDATE USING (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

-- RLS: Consumable Stock
CREATE POLICY consumables_select ON consumable_stock
  FOR SELECT USING (company_id = get_current_user_company());

CREATE POLICY consumables_insert_wm_cfo ON consumable_stock
  FOR INSERT WITH CHECK (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

CREATE POLICY consumables_update_wm_cfo ON consumable_stock
  FOR UPDATE USING (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

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
  )
  WITH CHECK (
    (get_current_user_role() = 'cfo') OR 
    (
      requested_by = (SELECT r.requested_by FROM requests r WHERE r.id = id) AND
      company_id = (SELECT r.company_id FROM requests r WHERE r.id = id) AND
      project_name = (SELECT r.project_name FROM requests r WHERE r.id = id)
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
  )
  WITH CHECK (
    estimated_cost_ugx = (SELECT p.estimated_cost_ugx FROM procurement_requests p WHERE p.id = id) AND
    created_by = (SELECT p.created_by FROM procurement_requests p WHERE p.id = id) AND
    company_id = (SELECT p.company_id FROM procurement_requests p WHERE p.id = id)
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

-- 6. NOTIFICATIONS SCHEMA
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (company_id = get_current_user_company() AND user_id = auth.uid());

CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (company_id = get_current_user_company() AND user_id = auth.uid());

CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (
    company_id = get_current_user_company() AND
    get_current_user_role() IN ('warehouse_manager', 'cfo')
  );


-- 7. PHASE TWO ADDITIONS

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'damage_status') THEN
    CREATE TYPE damage_status AS ENUM ('open', 'under_repair', 'resolved', 'written_off');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grn_condition') THEN
    CREATE TYPE grn_condition AS ENUM ('good', 'damaged', 'pending_inspection');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preferred_notif_channel') THEN
    CREATE TYPE preferred_notif_channel AS ENUM ('whatsapp', 'email', 'both', 'in_app_only');
  END IF;
END
$$;

-- Table: damage_reports
CREATE TABLE IF NOT EXISTS damage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  originating_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL REFERENCES users(id),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  damage_description TEXT NOT NULL,
  estimated_repair_cost_ugx NUMERIC,
  actual_repair_cost_ugx NUMERIC,
  vendor_name TEXT,
  status damage_status NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: grn_documents
CREATE TABLE IF NOT EXISTS grn_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  grn_number TEXT NOT NULL UNIQUE,
  received_by UUID NOT NULL REFERENCES users(id),
  supplier_name TEXT,
  delivery_note_ref TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: grn_items
CREATE TABLE IF NOT EXISTS grn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES grn_documents(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  consumable_id UUID REFERENCES consumable_stock(id) ON DELETE SET NULL,
  quantity_received NUMERIC NOT NULL CHECK (quantity_received > 0),
  unit_value_ugx NUMERIC NOT NULL CHECK (unit_value_ugx >= 0),
  condition_on_arrival grn_condition NOT NULL DEFAULT 'good',
  notes TEXT,
  CONSTRAINT grn_item_source_check CHECK (
    (equipment_id IS NOT NULL AND consumable_id IS NULL) OR
    (equipment_id IS NULL AND consumable_id IS NOT NULL)
  )
);

-- Table: notification_channels
CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  whatsapp_number TEXT,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_channel preferred_notif_channel NOT NULL DEFAULT 'in_app_only',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additive Table Alterations
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS damage_report_id UUID REFERENCES damage_reports(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS grn_id UUID REFERENCES grn_documents(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- Add 'grn' to entry_method enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'entry_method' AND e.enumlabel = 'grn'
  ) THEN
    ALTER TYPE entry_method ADD VALUE 'grn';
  END IF;
END
$$;

-- RLS: damage_reports
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY damage_reports_select ON damage_reports
  FOR SELECT USING (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

CREATE POLICY damage_reports_insert ON damage_reports
  FOR INSERT WITH CHECK (company_id = get_current_user_company() AND get_current_user_role() = 'warehouse_manager');

CREATE POLICY damage_reports_update ON damage_reports
  FOR UPDATE USING (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

-- RLS: grn_documents
ALTER TABLE grn_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY grn_documents_select ON grn_documents
  FOR SELECT USING (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

CREATE POLICY grn_documents_insert ON grn_documents
  FOR INSERT WITH CHECK (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

-- RLS: grn_items
ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY grn_items_select ON grn_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM grn_documents g 
      WHERE g.id = grn_id AND g.company_id = get_current_user_company()
    ) AND 
    get_current_user_role() IN ('warehouse_manager', 'cfo')
  );

CREATE POLICY grn_items_insert ON grn_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM grn_documents g 
      WHERE g.id = grn_id AND g.company_id = get_current_user_company()
    ) AND 
    get_current_user_role() IN ('warehouse_manager', 'cfo')
  );

-- RLS: notification_channels
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_channels_manage ON notification_channels
  FOR ALL USING (
    user_id = auth.uid() OR 
    get_current_user_role() = 'cfo'
  );


-- Phase Three Additions

-- Add 'qr_scan' to entry_method enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'entry_method' AND e.enumlabel = 'qr_scan'
  ) THEN
    ALTER TYPE entry_method ADD VALUE 'qr_scan';
  END IF;
END
$$;

-- Create qr_labels table
CREATE TABLE IF NOT EXISTS qr_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  consumable_id UUID REFERENCES consumable_stock(id) ON DELETE CASCADE,
  label_code TEXT UNIQUE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  printed_at TIMESTAMPTZ,
  CONSTRAINT check_only_one_target CHECK (
    (equipment_id IS NOT NULL AND consumable_id IS NULL) OR
    (equipment_id IS NULL AND consumable_id IS NOT NULL)
  )
);

-- Add qr_label_id to equipment and consumable_stock tables
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS qr_label_id UUID REFERENCES qr_labels(id) ON DELETE SET NULL;
ALTER TABLE consumable_stock ADD COLUMN IF NOT EXISTS qr_label_id UUID REFERENCES qr_labels(id) ON DELETE SET NULL;

-- Create report_type and report_format enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type_enum') THEN
    CREATE TYPE report_type_enum AS ENUM ('inventory_valuation', 'stock_movements', 'damage_costs', 'full_audit');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_format_enum') THEN
    CREATE TYPE report_format_enum AS ENUM ('pdf', 'excel');
  END IF;
END
$$;

-- Create report_exports table
CREATE TABLE IF NOT EXISTS report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_type report_type_enum NOT NULL,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  format report_format_enum NOT NULL,
  file_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- RLS: qr_labels
ALTER TABLE qr_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY qr_labels_select ON qr_labels
  FOR SELECT USING (company_id = get_current_user_company() AND get_current_user_role() IN ('pm', 'warehouse_manager', 'cfo'));

CREATE POLICY qr_labels_insert ON qr_labels
  FOR INSERT WITH CHECK (company_id = get_current_user_company() AND get_current_user_role() IN ('warehouse_manager', 'cfo'));

-- RLS: report_exports
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_exports_cfo ON report_exports
  FOR ALL USING (company_id = get_current_user_company() AND get_current_user_role() = 'cfo');


-- 8. TRANSACTIONAL SECURITY DEFINER RPC FUNCTIONS

-- RPC 1: Create request with atomic line item verification and threshold routing
CREATE OR REPLACE FUNCTION rpc_create_request(
  p_project_name TEXT,
  p_site_location TEXT,
  p_needed_from TIMESTAMPTZ,
  p_needed_until TIMESTAMPTZ,
  p_items JSONB
)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
  v_user_role user_role;
  v_threshold NUMERIC;
  v_routes_to_cfo BOOLEAN := false;
  v_request_id UUID;
  v_item JSONB;
  v_eq_val NUMERIC;
  v_eq_name TEXT;
  v_eq_status equipment_status;
  v_eq_count INT;
  v_con_val NUMERIC;
  v_con_qty NUMERIC;
  v_qty_req INT;
  v_eq_id UUID;
  v_con_id UUID;
BEGIN
  -- Resolve company and role
  v_company_id := get_current_user_company();
  v_user_role := get_current_user_role();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User session company not found.';
  END IF;

  -- Load threshold limit from settings
  SELECT COALESCE(approval_threshold_ugx, 500000)
  INTO v_threshold
  FROM settings
  WHERE company_id = v_company_id;

  IF NOT FOUND THEN
    v_threshold := 500000;
  END IF;

  -- Validate and inspect each item in json array to decide routing
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_eq_id := (v_item->>'equipment_id')::UUID;
    v_con_id := (v_item->>'consumable_id')::UUID;
    v_qty_req := (v_item->>'quantity_requested')::INT;

    IF v_eq_id IS NOT NULL THEN
      SELECT unit_value_ugx, name, status
      INTO v_eq_val, v_eq_name, v_eq_status
      FROM equipment
      WHERE id = v_eq_id AND company_id = v_company_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Equipment unit not found.';
      END IF;

      IF v_eq_status != 'available' THEN
        RAISE EXCEPTION 'Equipment unit % is not available.', v_eq_name;
      END IF;

      IF v_eq_val >= v_threshold THEN
        v_routes_to_cfo := true;
      END IF;

      -- Check remaining available stock of same name
      SELECT COUNT(*)
      INTO v_eq_count
      FROM equipment
      WHERE name = v_eq_name AND status = 'available' AND company_id = v_company_id;

      IF v_eq_count <= 1 THEN
        v_routes_to_cfo := true;
      END IF;

    ELSIF v_con_id IS NOT NULL THEN
      SELECT unit_value_ugx, quantity_on_hand
      INTO v_con_val, v_con_qty
      FROM consumable_stock
      WHERE id = v_con_id AND company_id = v_company_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Consumable SKU not found.';
      END IF;

      IF v_con_qty < v_qty_req THEN
        RAISE EXCEPTION 'Insufficient stock for consumable SKU.';
      END IF;

      -- Check leaves at least 1 unit remaining
      IF v_con_val >= v_threshold OR v_con_qty - v_qty_req < 1 THEN
        v_routes_to_cfo := true;
      END IF;
    END IF;
  END LOOP;

  -- Create request row
  INSERT INTO requests (
    company_id,
    requested_by,
    project_name,
    site_location,
    needed_from,
    needed_until,
    status,
    routed_to
  ) VALUES (
    v_company_id,
    auth.uid(),
    p_project_name,
    p_site_location,
    p_needed_from,
    p_needed_until,
    'pending',
    CASE WHEN v_routes_to_cfo THEN 'cfo'::routed_role ELSE 'warehouse_manager'::routed_role END
  )
  RETURNING id INTO v_request_id;

  -- Create item mappings
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_eq_id := (v_item->>'equipment_id')::UUID;
    v_con_id := (v_item->>'consumable_id')::UUID;
    v_qty_req := (v_item->>'quantity_requested')::INT;

    INSERT INTO request_items (
      request_id,
      equipment_id,
      consumable_id,
      quantity_requested
    ) VALUES (
      v_request_id,
      v_eq_id,
      v_con_id,
      v_qty_req
    );
  END LOOP;

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 2: Atomic checkout request processing with stock decrement
CREATE OR REPLACE FUNCTION rpc_checkout_request(
  p_request_id UUID,
  p_entry_method entry_method DEFAULT 'manual'
)
RETURNS VOID AS $$
DECLARE
  v_company_id UUID;
  v_user_role user_role;
  v_site_location TEXT;
  v_requested_by UUID;
  v_project_name TEXT;
  v_item RECORD;
  v_current_stock NUMERIC;
BEGIN
  -- Resolve company and role
  v_company_id := get_current_user_company();
  v_user_role := get_current_user_role();

  IF v_user_role IS NULL OR v_user_role NOT IN ('warehouse_manager', 'cfo') THEN
    RAISE EXCEPTION 'Unauthorized: Only warehouse managers and CFOs can process checkouts.';
  END IF;

  -- Fetch request details and check company ownership
  SELECT site_location, requested_by, project_name
  INTO v_site_location, v_requested_by, v_project_name
  FROM requests
  WHERE id = p_request_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or unauthorized.';
  END IF;

  -- Process each line item
  FOR v_item IN 
    SELECT equipment_id, consumable_id, quantity_requested 
    FROM request_items 
    WHERE request_id = p_request_id
  LOOP
    IF v_item.equipment_id IS NOT NULL THEN
      -- Reusable item
      UPDATE equipment
      SET status = 'checked_out',
          current_location = COALESCE(v_site_location, 'Field Site')
      WHERE id = v_item.equipment_id AND company_id = v_company_id AND status = 'available';

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Equipment unit not available or unauthorized.';
      END IF;

      -- Log transaction
      INSERT INTO transactions (
        company_id,
        transaction_type,
        equipment_id,
        request_id,
        quantity,
        performed_by,
        counterparty,
        notes,
        entry_method
      ) VALUES (
        v_company_id,
        'checkout',
        v_item.equipment_id,
        p_request_id,
        1,
        auth.uid(),
        v_requested_by,
        'Checked out for project: ' || v_project_name,
        p_entry_method
      );

    ELSIF v_item.consumable_id IS NOT NULL THEN
      -- Consumable item (with row lock on stock)
      SELECT quantity_on_hand INTO v_current_stock
      FROM consumable_stock
      WHERE id = v_item.consumable_id AND company_id = v_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Consumable SKU not found or unauthorized.';
      END IF;

      IF v_current_stock < v_item.quantity_requested THEN
        RAISE EXCEPTION 'Insufficient stock for consumable SKU.';
      END IF;

      -- Decrement stock
      UPDATE consumable_stock
      SET quantity_on_hand = v_current_stock - v_item.quantity_requested
      WHERE id = v_item.consumable_id;

      -- Log transaction
      INSERT INTO transactions (
        company_id,
        transaction_type,
        consumable_id,
        request_id,
        quantity,
        performed_by,
        counterparty,
        notes,
        entry_method
      ) VALUES (
        v_company_id,
        'stock_consumed',
        v_item.consumable_id,
        p_request_id,
        v_item.quantity_requested,
        auth.uid(),
        v_requested_by,
        'Consumed for project: ' || v_project_name,
        p_entry_method
      );
    END IF;
  END LOOP;

  -- Mark request as fulfilled
  UPDATE requests
  SET status = 'fulfilled'
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 3: Return request item with damage report auto-generation
CREATE OR REPLACE FUNCTION rpc_return_request_item(
  p_request_id UUID,
  p_equipment_id UUID,
  p_condition condition_type,
  p_notes TEXT,
  p_entry_method entry_method DEFAULT 'manual'
)
RETURNS VOID AS $$
DECLARE
  v_company_id UUID;
  v_user_role user_role;
  v_requested_by UUID;
  v_eq_status equipment_status;
  v_eq_loc TEXT;
  v_updated_notes TEXT;
  v_tx_id UUID;
  v_dr_id UUID;
  v_remaining_checked_out INT;
BEGIN
  -- Resolve company and role
  v_company_id := get_current_user_company();
  v_user_role := get_current_user_role();

  IF v_user_role IS NULL OR v_user_role NOT IN ('warehouse_manager', 'cfo') THEN
    RAISE EXCEPTION 'Unauthorized: Only warehouse managers and CFOs can process returns.';
  END IF;

  -- Fetch request details and check company ownership
  SELECT requested_by INTO v_requested_by
  FROM requests
  WHERE id = p_request_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or unauthorized.';
  END IF;

  -- Verify equipment status and lock it
  SELECT status INTO v_eq_status
  FROM equipment
  WHERE id = p_equipment_id AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment item not found or unauthorized.';
  END IF;

  IF v_eq_status NOT IN ('checked_out', 'overdue') THEN
    RAISE EXCEPTION 'Equipment unit is not currently checked out.';
  END IF;

  -- Set status and location based on condition
  IF p_condition = 'good' THEN
    v_eq_status := 'available';
    v_eq_loc := 'Kampala Central Warehouse';
  ELSE
    v_eq_status := 'under_repair';
    v_eq_loc := 'Repair Bay';
  END IF;

  v_updated_notes := COALESCE(p_notes, '') || ' (Logged during return as ' || p_condition::text || ')';

  -- Update equipment
  UPDATE equipment
  SET status = v_eq_status,
      current_location = v_eq_loc,
      condition_notes = v_updated_notes
  WHERE id = p_equipment_id;

  -- Log return transaction
  INSERT INTO transactions (
    company_id,
    transaction_type,
    equipment_id,
    request_id,
    quantity,
    performed_by,
    counterparty,
    condition_at_event,
    notes,
    entry_method
  ) VALUES (
    v_company_id,
    'return',
    p_equipment_id,
    p_request_id,
    1,
    auth.uid(),
    v_requested_by,
    p_condition,
    COALESCE(p_notes, 'Returned condition: ' || p_condition::text),
    p_entry_method
  )
  RETURNING id INTO v_tx_id;

  -- Auto-create damage report if condition is not good
  IF p_condition != 'good' THEN
    INSERT INTO damage_reports (
      company_id,
      equipment_id,
      originating_transaction_id,
      reported_by,
      reported_at,
      damage_description,
      status
    ) VALUES (
      v_company_id,
      p_equipment_id,
      v_tx_id,
      auth.uid(),
      now(),
      COALESCE(p_notes, 'Logged return condition: ' || p_condition::text),
      'open'
    )
    RETURNING id INTO v_dr_id;

    -- Link damage report to equipment
    UPDATE equipment
    SET damage_report_id = v_dr_id
    WHERE id = p_equipment_id;
  END IF;

  -- Check if all reusable items in this request have been returned
  SELECT COUNT(*) INTO v_remaining_checked_out
  FROM request_items ri
  JOIN equipment e ON e.id = ri.equipment_id
  WHERE ri.request_id = p_request_id 
    AND e.status = 'checked_out';

  IF v_remaining_checked_out = 0 THEN
    UPDATE requests
    SET status = 'returned'
    WHERE id = p_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


