CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL DEFAULT current_clinic_id() REFERENCES public.clinics(id),
  service text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage invoice items" ON public.invoice_items
FOR ALL TO authenticated
USING (is_staff(auth.uid()) AND clinic_id = current_clinic_id())
WITH CHECK (is_staff(auth.uid()) AND clinic_id = current_clinic_id());

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_clinic_id ON public.invoice_items(clinic_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_invoice_items_updated_at
BEFORE UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.invoice_items (invoice_id, clinic_id, service, price, created_at)
SELECT i.id, i.clinic_id, COALESCE(NULLIF(i.service, ''), 'خدمة'), COALESCE(i.price, 0), COALESCE(i.created_at, now())
FROM public.invoices i
WHERE COALESCE(NULLIF(i.service, ''), '') <> '' OR COALESCE(i.price, 0) > 0;