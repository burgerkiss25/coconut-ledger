-- Run these statements in Supabase SQL editor to enforce required references and non-negative values.
-- Adjust existing data before enabling if current rows violate the constraints.

-- Require joint reference and date on entries
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entries_joint_id_not_null') THEN
    ALTER TABLE public.entries ADD CONSTRAINT entries_joint_id_not_null CHECK (joint_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entries_entry_date_not_null') THEN
    ALTER TABLE public.entries ADD CONSTRAINT entries_entry_date_not_null CHECK (entry_date IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entries_joint_fk') THEN
    ALTER TABLE public.entries ADD CONSTRAINT entries_joint_fk FOREIGN KEY (joint_id) REFERENCES public.joints(id);
  END IF;
END $$;

-- Block negative numeric values on entries
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entries_non_negative') THEN
    ALTER TABLE public.entries ADD CONSTRAINT entries_non_negative CHECK (
      start_table >= 0 AND
      given_local >= 0 AND
      given_agric >= 0 AND
      transfer_in >= 0 AND
      transfer_out >= 0 AND
      sales_ghs >= 0 AND
      broken >= 0 AND
      paid_cash_ghs >= 0 AND
      paid_momo_ghs >= 0 AND
      paid_ghs >= 0 AND
      paid_given >= 0 AND
      bonus >= 0 AND
      sold >= 0 AND
      owner_due_given >= 0 AND
      owner_due_sales >= 0 AND
      remaining >= 0
    );
  END IF;
END $$;

-- Prevent negative balances and empty references
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'joint_balances_joint_not_null') THEN
    ALTER TABLE public.joint_balances ADD CONSTRAINT joint_balances_joint_not_null CHECK (joint_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'joint_balances_joint_fk') THEN
    ALTER TABLE public.joint_balances ADD CONSTRAINT joint_balances_joint_fk FOREIGN KEY (joint_id) REFERENCES public.joints(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'joint_balances_non_negative') THEN
    ALTER TABLE public.joint_balances ADD CONSTRAINT joint_balances_non_negative CHECK (debt_ghs >= 0);
  END IF;
END $$;
