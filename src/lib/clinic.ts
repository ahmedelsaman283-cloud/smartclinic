export type AppointmentStatus = "waiting" | "with_doctor" | "done" | "cancelled";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  waiting: "في الانتظار",
  with_doctor: "مع الطبيب",
  done: "انتهى",
  cancelled: "ملغي",
};

export const STATUS_OPTIONS: AppointmentStatus[] = ["waiting", "with_doctor", "done", "cancelled"];

export type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string | null;
};

export type Appointment = {
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  created_at: string | null;
};

export type AppointmentWithPatient = Appointment & { patients: Pick<Patient, "id" | "full_name" | "phone"> | null };

export type Invoice = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  service: string | null;
  price: number | null;
  payment_status: "paid" | "unpaid";
  created_at: string | null;
  patients?: Pick<Patient, "id" | "full_name"> | null;
};

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = Number(h);
  const suffix = hour < 12 ? "ص" : "م";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}
