-- Supabase Database Schema for Egypro EquipTrack (Phase One)

-- 1. ENUMS AND TYPES
CREATE TYPE user_role AS ENUM ('coordinator', 'pm', 'warehouse_manager', 'cfo', 'md');
CREATE TYPE category_item_type AS ENUM ('reusable', 'consumable');
CREATE TYPE equipment_status AS ENUM ('available', 'checked_out', 'overdue', 'under_repair', 'retired', 'pending_inspection');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'fulfilled', 'returned', 'cancelled', 'changes_requested', 'superseded');
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
  project_id UUID REFERENCES projects(id),
  project_name TEXT,
  site_location TEXT,
  needed_from DATE NOT NULL,
  needed_until DATE,
  status request_status NOT NULL DEFAULT 'pending',
  routed_to route_target NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  reviewer_note TEXT,
  revision_number INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES requests(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_reference_chk CHECK (project_id IS NOT NULL OR project_name IS NOT NULL)
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


-- 9. CASH ADVANCES & ACCOUNTABILITY SCHEMA

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'advance_status') THEN
    CREATE TYPE advance_status AS ENUM ('pending', 'approved', 'rejected', 'disbursed', 'partially_retired', 'retired', 'overdue', 'changes_requested', 'superseded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disbursement_method') THEN
    CREATE TYPE disbursement_method AS ENUM ('bank_transfer', 'cash');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'retirement_category') THEN
    CREATE TYPE retirement_category AS ENUM ('fuel', 'allowances', 'materials', 'accommodation', 'other');
  END IF;
END
$$;

-- Table: cash_advances
CREATE TABLE IF NOT EXISTS cash_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  project_name TEXT,
  purpose TEXT NOT NULL,
  amount_requested_ugx NUMERIC(15, 2) NOT NULL CHECK (amount_requested_ugx > 0),
  expected_retirement_date DATE NOT NULL,
  status advance_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  reviewer_note TEXT,
  revision_number INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES cash_advances(id),
  md_consultation_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_reference_chk CHECK (project_id IS NOT NULL OR project_name IS NOT NULL)
);

-- Table: advance_disbursements
CREATE TABLE IF NOT EXISTS advance_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  advance_id UUID NOT NULL UNIQUE REFERENCES cash_advances(id) ON DELETE CASCADE,
  method disbursement_method NOT NULL,
  amount_ugx NUMERIC(15, 2) NOT NULL CHECK (amount_ugx > 0),
  bank_reference TEXT,
  bank_account TEXT,
  witness_name TEXT,
  signed_proof_url TEXT,
  disbursed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disbursed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT method_requirements CHECK (
    (method = 'bank_transfer' AND bank_reference IS NOT NULL AND bank_account IS NOT NULL) OR
    (method = 'cash' AND witness_name IS NOT NULL AND signed_proof_url IS NOT NULL)
  )
);

-- Table: retirement_entries (Append-Only)
CREATE TABLE IF NOT EXISTS retirement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  advance_id UUID NOT NULL REFERENCES cash_advances(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category retirement_category NOT NULL,
  description TEXT NOT NULL,
  amount_ugx NUMERIC(15, 2) NOT NULL CHECK (amount_ugx > 0),
  receipt_photo_url TEXT NOT NULL,
  entry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View: advance_balances
CREATE OR REPLACE VIEW advance_balances AS
SELECT
  ca.id AS advance_id,
  ca.requested_by,
  ca.company_id,
  COALESCE(ad.amount_ugx, 0) AS amount_disbursed_ugx,
  COALESCE(SUM(re.amount_ugx), 0) AS amount_retired_ugx,
  COALESCE(ad.amount_ugx, 0) - COALESCE(SUM(re.amount_ugx), 0) AS outstanding_ugx,
  ca.expected_retirement_date,
  ca.status
FROM cash_advances ca
LEFT JOIN advance_disbursements ad ON ad.advance_id = ca.id
LEFT JOIN retirement_entries re ON re.advance_id = ca.id
GROUP BY ca.id, ad.amount_ugx;

-- RLS: cash_advances
ALTER TABLE cash_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY advances_select_own_pm ON cash_advances
  FOR SELECT USING (company_id = get_current_user_company() AND requested_by = auth.uid());

CREATE POLICY advances_select_all_cfo ON cash_advances
  FOR SELECT USING (company_id = get_current_user_company() AND get_current_user_role() = 'cfo');

CREATE POLICY advances_update_cfo ON cash_advances
  FOR UPDATE USING (company_id = get_current_user_company() AND get_current_user_role() = 'cfo')
  WITH CHECK (
    company_id = (SELECT c.company_id FROM cash_advances c WHERE c.id = id) AND
    requested_by = (SELECT c.requested_by FROM cash_advances c WHERE c.id = id) AND
    amount_requested_ugx = (SELECT c.amount_requested_ugx FROM cash_advances c WHERE c.id = id)
  );

-- RLS: advance_disbursements
ALTER TABLE advance_disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY disbursements_select ON advance_disbursements
  FOR SELECT USING (
    company_id = get_current_user_company() AND (
      get_current_user_role() = 'cfo' OR
      EXISTS (SELECT 1 FROM cash_advances ca WHERE ca.id = advance_id AND ca.requested_by = auth.uid())
    )
  );

-- RLS: retirement_entries
ALTER TABLE retirement_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY retirement_select ON retirement_entries
  FOR SELECT USING (
    company_id = get_current_user_company() AND (
      get_current_user_role() = 'cfo' OR submitted_by = auth.uid()
    )
  );

-- Direct client modifications (INSERT/UPDATE/DELETE) on disbursements and retirements are denied by default.
-- All writes are handled via database SECURITY DEFINER RPCs.


-- RPC 1: Request Cash Advance (PM Only)
CREATE OR REPLACE FUNCTION rpc_request_cash_advance(
  p_project_name TEXT,
  p_purpose TEXT,
  p_amount_requested_ugx NUMERIC,
  p_expected_retirement_date DATE
)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
  v_user_role user_role;
  v_has_overdue BOOLEAN;
  v_advance_id UUID;
BEGIN
  -- Resolve company and role
  v_company_id := get_current_user_company();
  v_user_role := get_current_user_role();

  IF v_user_role IS NULL OR v_user_role != 'pm' THEN
    RAISE EXCEPTION 'Unauthorized: Only Project Managers can request cash advances.';
  END IF;

  -- Check if user has any overdue cash advances
  SELECT EXISTS (
    SELECT 1 FROM cash_advances
    WHERE requested_by = auth.uid() AND status = 'overdue' AND company_id = v_company_id
  ) INTO v_has_overdue;

  IF v_has_overdue THEN
    RAISE EXCEPTION 'Blocked: You have overdue cash advances that must be accounted for first.';
  END IF;

  -- Insert advance
  INSERT INTO cash_advances (
    company_id,
    requested_by,
    project_name,
    purpose,
    amount_requested_ugx,
    expected_retirement_date,
    status
  ) VALUES (
    v_company_id,
    auth.uid(),
    p_project_name,
    p_purpose,
    p_amount_requested_ugx,
    p_expected_retirement_date,
    'pending'
  )
  RETURNING id INTO v_advance_id;

  -- Send notifications to CFOs
  INSERT INTO notifications (
    company_id,
    user_id,
    title,
    message,
    link
  )
  SELECT 
    v_company_id,
    u.id,
    'New Cash Advance Request',
    (SELECT full_name FROM users WHERE id = auth.uid()) || ' requested a cash advance of ' || p_amount_requested_ugx::text || ' UGX for project "' || p_project_name || '".',
    '/advances'
  FROM users u
  WHERE u.company_id = v_company_id AND u.role = 'cfo' AND u.is_active = true;

  RETURN v_advance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 2: Disburse Cash Advance (CFO Only)
CREATE OR REPLACE FUNCTION rpc_disburse_advance(
  p_advance_id UUID,
  p_method disbursement_method,
  p_amount_ugx NUMERIC,
  p_bank_reference TEXT,
  p_bank_account TEXT,
  p_witness_name TEXT,
  p_signed_proof_url TEXT
)
RETURNS VOID AS $$
DECLARE
  v_company_id UUID;
  v_user_role user_role;
  v_status advance_status;
BEGIN
  -- Resolve company and role
  v_company_id := get_current_user_company();
  v_user_role := get_current_user_role();

  IF v_user_role IS NULL OR v_user_role != 'cfo' THEN
    RAISE EXCEPTION 'Unauthorized: Only CFOs can disburse cash advances.';
  END IF;

  -- Lock advance and verify
  SELECT status INTO v_status
  FROM cash_advances
  WHERE id = p_advance_id AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance request not found.';
  END IF;

  IF v_status != 'approved' THEN
    RAISE EXCEPTION 'Advance request is not in APPROVED state.';
  END IF;

  -- Enforce check constraints in code block
  IF p_method = 'bank_transfer' AND (p_bank_reference IS NULL OR p_bank_account IS NULL) THEN
    RAISE EXCEPTION 'Invalid disbursement: Bank reference and bank account are required for transfer disbursements.';
  END IF;

  IF p_method = 'cash' AND (p_witness_name IS NULL OR p_signed_proof_url IS NULL) THEN
    RAISE EXCEPTION 'Invalid disbursement: Witness name and signed proof receipt upload are required for cash handovers.';
  END IF;

  -- Create disbursement entry
  INSERT INTO advance_disbursements (
    company_id,
    advance_id,
    method,
    amount_ugx,
    bank_reference,
    bank_account,
    witness_name,
    signed_proof_url,
    disbursed_by
  ) VALUES (
    v_company_id,
    p_advance_id,
    p_method,
    p_amount_ugx,
    p_bank_reference,
    p_bank_account,
    p_witness_name,
    p_signed_proof_url,
    auth.uid()
  );

  -- Transition status
  UPDATE cash_advances
  SET status = 'disbursed'
  WHERE id = p_advance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 3: Submit Retirement Entry (PM Only)
CREATE OR REPLACE FUNCTION rpc_submit_retirement_entry(
  p_advance_id UUID,
  p_category retirement_category,
  p_description TEXT,
  p_amount_ugx NUMERIC,
  p_entry_date DATE,
  p_receipt_photo_url TEXT
)
RETURNS VOID AS $$
DECLARE
  v_company_id UUID;
  v_user_role user_role;
  v_requested_by UUID;
  v_status advance_status;
  v_disbursed NUMERIC;
  v_retired NUMERIC;
BEGIN
  -- Resolve company and role
  v_company_id := get_current_user_company();
  v_user_role := get_current_user_role();

  IF v_user_role IS NULL OR v_user_role != 'pm' THEN
    RAISE EXCEPTION 'Unauthorized: Only Project Managers can submit retirement entries.';
  END IF;

  -- Lock advance details and verify
  SELECT requested_by, status INTO v_requested_by, v_status
  FROM cash_advances
  WHERE id = p_advance_id AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cash advance record not found.';
  END IF;

  IF v_requested_by != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only submit accountability entries for your own cash advances.';
  END IF;

  IF v_status NOT IN ('disbursed', 'partially_retired', 'overdue') THEN
    RAISE EXCEPTION 'Invalid state: accountability reports can only be added to active disbursed advances.';
  END IF;

  -- Insert retirement entry
  INSERT INTO retirement_entries (
    company_id,
    advance_id,
    submitted_by,
    category,
    description,
    amount_ugx,
    receipt_photo_url,
    entry_date
  ) VALUES (
    v_company_id,
    p_advance_id,
    auth.uid(),
    p_category,
    p_description,
    p_amount_ugx,
    p_receipt_photo_url,
    p_entry_date
  );

  -- Recalculate balances
  SELECT amount_disbursed_ugx, amount_retired_ugx INTO v_disbursed, v_retired
  FROM advance_balances
  WHERE advance_id = p_advance_id;

  IF v_retired >= v_disbursed THEN
    UPDATE cash_advances
    SET status = 'retired'
    WHERE id = p_advance_id;
  ELSE
    UPDATE cash_advances
    SET status = 'partially_retired'
    WHERE id = p_advance_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 4: Check Overdue Advances (Scheduled Trigger)
CREATE OR REPLACE FUNCTION rpc_check_overdue_advances()
RETURNS VOID AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Select all active disbursed advances where date has passed
  FOR v_record IN
    SELECT id, company_id, requested_by, project_name, amount_requested_ugx
    FROM cash_advances
    WHERE status IN ('disbursed', 'partially_retired')
      AND expected_retirement_date < current_date
  LOOP
    -- Lock row and transition status
    UPDATE cash_advances
    SET status = 'overdue'
    WHERE id = v_record.id;

    -- Send notifications to PM
    INSERT INTO notifications (
      company_id,
      user_id,
      title,
      message,
      link
    ) VALUES (
      v_record.company_id,
      v_record.requested_by,
      'Cash Advance Overdue',
      'Your advance for project ' || v_record.project_name || ' is overdue. Please submit accountability receipts.',
      '/advances'
    );

    -- Send notifications to CFOs
    INSERT INTO notifications (
      company_id,
      user_id,
      title,
      message,
      link
    )
    SELECT 
      v_record.company_id,
      u.id,
      'PM Cash Advance Overdue',
      'An advance of ' || v_record.amount_requested_ugx::text || ' UGX is overdue for accountability checks.',
      '/advances'
    FROM users u
    WHERE u.company_id = v_record.company_id AND u.role = 'cfo' AND u.is_active = true;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- PROJECTS & ASSIGNMENTS (Roles, Projects & Notifications Update)
-- =========================================================================

CREATE TYPE project_status AS ENUM ('active', 'completed', 'on_hold');

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  site_location TEXT,
  status project_status NOT NULL DEFAULT 'active',
  estimated_budget_ugx NUMERIC,
  budget_notes TEXT,
  budget_set_by UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE assignment_role AS ENUM ('coordinator', 'pm');

CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role_on_project assignment_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ
);

-- RLS Enforcement
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON projects
  FOR SELECT USING (
    company_id = get_current_user_company() AND (
      get_current_user_role() IN ('cfo', 'md', 'warehouse_manager') OR
      EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = id
          AND pa.user_id = auth.uid()
      )
    )
  );

CREATE POLICY projects_insert ON projects
  FOR INSERT WITH CHECK (
    company_id = get_current_user_company() AND get_current_user_role() = 'cfo'
  );

CREATE POLICY projects_update ON projects
  FOR UPDATE USING (
    company_id = get_current_user_company() AND (
      get_current_user_role() IN ('cfo', 'md') OR (
        get_current_user_role() = 'pm' AND EXISTS (
          SELECT 1 FROM project_assignments pa
          WHERE pa.project_id = id
            AND pa.user_id = auth.uid()
            AND pa.unassigned_at IS NULL
        )
      )
    )
  );

CREATE POLICY project_assignments_select ON project_assignments
  FOR SELECT USING (
    company_id = get_current_user_company() AND (
      get_current_user_role() IN ('cfo', 'md', 'warehouse_manager') OR user_id = auth.uid()
    )
  );

CREATE POLICY project_assignments_insert ON project_assignments
  FOR INSERT WITH CHECK (
    company_id = get_current_user_company() AND get_current_user_role() = 'cfo'
  );

CREATE POLICY project_assignments_update ON project_assignments
  FOR UPDATE USING (
    company_id = get_current_user_company() AND get_current_user_role() = 'cfo'
  );


-- =========================================================================
-- PM ENDORSEMENTS (Roles, Projects & Notifications Update)
-- =========================================================================

CREATE TABLE request_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE UNIQUE,
  endorsed_by UUID NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE advance_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  advance_id UUID NOT NULL REFERENCES cash_advances(id) ON DELETE CASCADE UNIQUE,
  endorsed_by UUID NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE request_endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY request_endorsements_select ON request_endorsements
  FOR SELECT USING (
    company_id = get_current_user_company()
  );

CREATE POLICY request_endorsements_insert ON request_endorsements
  FOR INSERT WITH CHECK (
    company_id = get_current_user_company() AND get_current_user_role() = 'pm'
  );

CREATE POLICY advance_endorsements_select ON advance_endorsements
  FOR SELECT USING (
    company_id = get_current_user_company()
  );

CREATE POLICY advance_endorsements_insert ON advance_endorsements
  FOR INSERT WITH CHECK (
    company_id = get_current_user_company() AND get_current_user_role() = 'pm'
  );




