CREATE TABLE public.patient_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL DEFAULT public.current_clinic_id() REFERENCES public.clinics(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'file',
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_files TO authenticated;
GRANT ALL ON public.patient_files TO service_role;

ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage patient files" ON public.patient_files
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_staff(auth.uid()) AND clinic_id = public.current_clinic_id());

CREATE INDEX patient_files_patient_idx ON public.patient_files(patient_id);

CREATE POLICY "clinic staff read patient files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'patient-files' AND public.is_staff(auth.uid())
    AND (storage.foldername(name))[1] = public.current_clinic_id()::text);

CREATE POLICY "clinic staff upload patient files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-files' AND public.is_staff(auth.uid())
    AND (storage.foldername(name))[1] = public.current_clinic_id()::text);

CREATE POLICY "clinic staff delete patient files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'patient-files' AND public.is_staff(auth.uid())
    AND (storage.foldername(name))[1] = public.current_clinic_id()::text);