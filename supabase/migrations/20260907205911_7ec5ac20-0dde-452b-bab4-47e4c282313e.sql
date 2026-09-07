-- 1. clinics table
CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  clinic_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- 2. seed the existing clinic
INSERT INTO public.clinics (name, clinic_code) VALUES ('Smart Clinic', 'SMARTCLINIC001');

-- 3. add clinic_id columns
ALTER TABLE public.profiles ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
ALTER TABLE public.patients ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
ALTER TABLE public.appointments ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
ALTER TABLE public.invoices ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- 4. helper: current user's clinic
CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 5. backfill existing rows
UPDATE public.profiles SET clinic_id = (SELECT id FROM public.clinics WHERE clinic_code = 'SMARTCLINIC001') WHERE clinic_id IS NULL;
UPDATE public.patients SET clinic_id = (SELECT id FROM public.clinics WHERE clinic_code = 'SMARTCLINIC001') WHERE clinic_id IS NULL;
UPDATE public.appointments SET clinic_id = (SELECT id FROM public.clinics WHERE clinic_code = 'SMARTCLINIC001') WHERE clinic_id IS NULL;
UPDATE public.invoices SET clinic_id = (SELECT id FROM public.clinics WHERE clinic_code = 'SMARTCLINIC001') WHERE clinic_id IS NULL;

-- 6. enforce NOT NULL + auto-fill for new rows
ALTER TABLE public.profiles ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.patients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE public.patients ALTER COLUMN clinic_id SET DEFAULT public.current_clinic_id();
ALTER TABLE public.appointments ALTER COLUMN clinic_id SET DEFAULT public.current_clinic_id();
ALTER TABLE public.invoices ALTER COLUMN clinic_id SET DEFAULT public.current_clinic_id();

CREATE INDEX idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX idx_appointments_clinic ON public.appointments(clinic_id);
CREATE INDEX idx_invoices_clinic ON public.invoices(clinic_id);
CREATE INDEX idx_profiles_clinic ON public.profiles(clinic_id);

-- 7. clinics visibility: only your own clinic
CREATE POLICY "own clinic select" ON public.clinics
FOR SELECT TO authenticated
USING (id = public.current_clinic_id());

-- 8. tenant-scoped policies
DROP POLICY IF EXISTS "staff manage patients" ON public.patients;
CREATE POLICY "staff manage patients" ON public.patients
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()) AND clinic_id = public.current_clinic_id())
WITH CHECK (public.is_staff(auth.uid()) AND clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS "staff manage appointments" ON public.appointments;
CREATE POLICY "staff manage appointments" ON public.appointments
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()) AND clinic_id = public.current_clinic_id())
WITH CHECK (public.is_staff(auth.uid()) AND clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS "staff manage invoices" ON public.invoices;
CREATE POLICY "staff manage invoices" ON public.invoices
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()) AND clinic_id = public.current_clinic_id())
WITH CHECK (public.is_staff(auth.uid()) AND clinic_id = public.current_clinic_id());

-- profiles: own profile, plus read colleagues within same clinic
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND clinic_id = public.current_clinic_id());

-- 9. new staff accounts join a clinic by clinic_code metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinic_id uuid;
BEGIN
  SELECT id INTO _clinic_id
  FROM public.clinics
  WHERE clinic_code = NULLIF(NEW.raw_user_meta_data->>'clinic_code', '');

  IF _clinic_id IS NULL THEN
    SELECT NULLIF(NEW.raw_user_meta_data->>'clinic_id', '')::uuid INTO _clinic_id;
  END IF;

  IF _clinic_id IS NULL THEN
    SELECT id INTO _clinic_id FROM public.clinics ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, role, clinic_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'receptionist'), _clinic_id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;