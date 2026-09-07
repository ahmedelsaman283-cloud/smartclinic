ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.profiles (id, role, clinic_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'receptionist'),
    _clinic_id,
    NULLIF(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;