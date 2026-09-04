# Smart Clinic Staff

Build a clinic management web app called "Smart Clinic" with 2 staff roles, each with separate login and dashboard: Receptionist and Doctor. There is NO patient-facing interface in this app — patient booking and follow-up are handled entirely through an external WhatsApp/Telegram bot connected via n8n, which writes directly to this same Supabase database. This app is purely a staff tool.

AUTHENTICATION

- Use Supabase Auth for login/signup

- There is no public signup page. Receptionist and Doctor accounts are created manually by an admin via Supabase Dashboard.

- After login, redirect each role to its own dashboard based on a "role" field stored in a "profiles" table (values: 'receptionist' or 'doctor').

- A single login page at /auth/staff with email + password. After successful login, fetch the user's role from "profiles" and redirect accordingly. If no matching role is found, show an error and sign the user out.

DESIGN

- Mobile-first design using a BOTTOM NAVIGATION BAR (not a sidebar) — similar to a mobile app, since staff will mostly use this on phones/tablets while moving around the clinic.

- Clean, calm, minimal design — white background, blue accent color, generous white space, rounded cards, soft shadows.

- All visible text, labels, buttons must be in Arabic, with right-to-left (RTL) layout. Only underlying code/variable names should be in English.

RECEPTIONIST DASHBOARD

Bottom nav tabs: الرئيسية (Home) / المرضى (Patients) / المواعيد (Appointments) / الفواتير (Invoices)

- Home screen: today's appointments table with columns: patient name, time, status. Status is a dropdown with options: waiting, with doctor, done, cancelled — changing it updates instantly.

- Each row also has a "تأكيد الوصول" (Confirm Arrival) button. Clicking it:

  1. Sets the appointment status to "waiting"

  2. Automatically creates a new invoice row (payment_status = 'unpaid') linked to that patient, ready for the receptionist to fill in the service/price afterward.

- "إضافة مريض جديد" (Add new patient) button opens a modal with fields: full name, phone number, date of birth.

- "حجز موعد فوري" (Add walk-in appointment) button to book a same-day appointment directly without going through the external chat bot — select existing patient or create new one inline, pick time and optional reason.

- Invoices page: list of invoices with patient name, service, price, payment status (paid/unpaid), and a button to mark as paid. Ability to edit service/price on invoices created via "confirm arrival".

- A search bar (on Patients page) to find any patient by name or phone, showing their basic info and appointment history.

DOCTOR DASHBOARD

Bottom nav tabs: قائمة اليوم (Today's Queue) / المرضى (Patients/Search)

- Today's Queue screen: today's patient queue in appointment order, showing name and time, with a clearly highlighted "current patient" card at the top and the rest of the waiting list below it. This should update in real time when the receptionist changes an appointment's status (e.g., to "with doctor").

- Clicking a patient opens their full file page (/doctor/patient/:id), with this EXACT order:

  1. Basic info section: name, phone, date of birth

  2. "السجل" (Medical History) section — a clear, fully visible timeline of all past visits (date + doctor's notes for each), sorted most recent first. This must appear BEFORE the note-taking area, so the doctor reviews history before writing today's diagnosis.

  3. "زيارة اليوم" (Today's Visit) section at the bottom — a text area to write notes for today's visit, with a "حفظ الملاحظات" (Save Notes) button that saves to the appointments table.

- A search bar (on Patients tab) to look up any patient's history by name or phone.

DATABASE (Supabase/Postgres)

Table "profiles":

  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('receptionist', 'doctor')),

  created_at TIMESTAMPTZ DEFAULT NOW()

Table "patients":

  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name TEXT NOT NULL,

  phone TEXT,

  date_of_birth DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()

Table "appointments":

  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  appointment_date DATE NOT NULL,

  appointment_time TIME NOT NULL,

  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'with_doctor', 'done', 'cancelled')),

  reason TEXT,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()

Table "invoices":

  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  service TEXT,

  price NUMERIC DEFAULT 0,

  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid')),

  created_at TIMESTAMPTZ DEFAULT NOW()

IMPORTANT — Auth trigger and permissions (required to avoid RLS/permission errors):

Enable RLS on all tables, with policies allowing any authenticated staff (role IN ('receptionist','doctor')) full access to patients, appointments, and invoices, and allowing users to read/update only their own profiles row.

Also run this trigger function exactly, including the explicit search_path and public schema prefix (required for the trigger to work correctly with Supabase's SECURITY DEFINER functions):

CREATE OR REPLACE FUNCTION public.handle_new_user()

RETURNS TRIGGER

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = public

AS $$

BEGIN

  INSERT INTO public.profiles (id, role)

  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'receptionist'))

  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

END;

$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created

  AFTER INSERT ON auth.users

  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

Also explicitly grant table permissions to the authenticated role (Supabase does not always do this automatically):

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;

Do not build any patient-facing pages, signup forms, or chat interfaces — this app is staff-only.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3ecf1b68-53a2-4373-a489-6a0ec74e4d23).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
