import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { receptionNav } from "@/components/nav-items";
import { AddPatientDialog } from "@/components/add-patient-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  STATUS_LABELS,
  formatDate,
  formatTime,
  type Appointment,
  type Patient,
} from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/reception/patients")({
  head: () => ({
    meta: [
      { title: "المرضى | استقبال العيادة الذكية" },
      { name: "description", content: "بحث عن المرضى وعرض بياناتهم وسجل مواعيدهم." },
      { property: "og:title", content: "المرضى | استقبال العيادة الذكية" },
      { property: "og:description", content: "بحث عن المرضى وعرض بياناتهم وسجل مواعيدهم." },
    ],
  }),
  component: ReceptionPatients,
});

function ReceptionPatients() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients", "list", search],
    queryFn: async () => {
      let query = supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(50);
      if (search.trim()) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Patient[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["appointments", "history", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", selected!.id)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });
      if (error) throw error;
      return data as Appointment[];
    },
  });

  return (
    <AppShell
      title="المرضى"
      nav={receptionNav}
      action={
        <AddPatientDialog
          trigger={
            <Button size="sm" className="h-9 rounded-full">
              <UserPlus className="ms-1 h-4 w-4" />
              جديد
            </Button>
          }
        />
      }
    >
      <div className="relative mb-4">
        <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف"
          className="h-12 rounded-2xl pe-10"
        />
      </div>

      {selected ? (
        <Card className="mb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold">{selected.full_name}</p>
              <p dir="ltr" className="text-right text-sm text-muted-foreground">
                {selected.phone ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                تاريخ الميلاد: {selected.date_of_birth ? formatDate(selected.date_of_birth) : "—"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              إغلاق
            </Button>
          </div>
          <h3 className="mt-4 mb-2 text-sm font-semibold">سجل المواعيد</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مواعيد سابقة</p>
          ) : (
            <ul className="space-y-2">
              {history.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex items-center justify-between rounded-2xl bg-secondary/60 px-3 py-2 text-sm"
                >
                  <span>
                    {formatDate(appointment.appointment_date)} · {formatTime(appointment.appointment_time)}
                  </span>
                  <span className="text-xs text-muted-foreground">{STATUS_LABELS[appointment.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {patients.length === 0 ? (
        <EmptyState text="لا توجد نتائج" />
      ) : (
        <div className="space-y-2">
          {patients.map((patient) => (
            <button key={patient.id} onClick={() => setSelected(patient)} className="w-full text-right">
              <Card className="flex items-center justify-between">
                <span className="font-medium">{patient.full_name}</span>
                <span dir="ltr" className="text-sm text-muted-foreground">
                  {patient.phone ?? "—"}
                </span>
              </Card>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
