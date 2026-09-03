import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { receptionNav } from "@/components/nav-items";
import { AddPatientDialog } from "@/components/add-patient-dialog";
import { WalkInDialog } from "@/components/walkin-dialog";
import { Button } from "@/components/ui/button";
import {
  STATUS_LABELS,
  STATUS_OPTIONS,
  formatDate,
  formatTime,
  todayISO,
  type AppointmentStatus,
  type AppointmentWithPatient,
} from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/reception/")({
  head: () => ({
    meta: [
      { title: "الرئيسية | استقبال العيادة الذكية" },
      { name: "description", content: "مواعيد اليوم وحالات المرضى في العيادة الذكية." },
      { property: "og:title", content: "الرئيسية | استقبال العيادة الذكية" },
      { property: "og:description", content: "مواعيد اليوم وحالات المرضى في العيادة الذكية." },
    ],
  }),
  component: ReceptionHome,
});

function ReceptionHome() {
  const queryClient = useQueryClient();
  const today = todayISO();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", "today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(id, full_name, phone)")
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true });
      if (error) throw error;
      return data as unknown as AppointmentWithPatient[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("reception-appointments")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    onError: () => toast.error("تعذر تحديث الحالة"),
  });

  const arrivalMutation = useMutation({
    mutationFn: async (appointment: AppointmentWithPatient) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "waiting" })
        .eq("id", appointment.id);
      if (error) throw error;
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("appointment_id", appointment.id)
        .maybeSingle();
      if (existing) return "exists" as const;
      const { error: invoiceError } = await supabase.from("invoices").insert({
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        payment_status: "unpaid",
      });
      if (invoiceError) throw invoiceError;
      return "created" as const;
    },
    onSuccess: (result) => {
      toast.success(result === "created" ? "تم تأكيد الوصول وإنشاء فاتورة" : "تم تأكيد الوصول");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => toast.error("تعذر تأكيد الوصول"),
  });

  return (
    <AppShell title="لوحة الاستقبال" subtitle={formatDate(today)} nav={receptionNav}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <AddPatientDialog
          trigger={
            <Button className="h-12 rounded-2xl text-sm">
              <UserPlus className="ms-1 h-4 w-4" />
              إضافة مريض جديد
            </Button>
          }
        />
        <WalkInDialog
          trigger={
            <Button variant="outline" className="h-12 rounded-2xl text-sm">
              <CalendarPlus className="ms-1 h-4 w-4" />
              حجز موعد فوري
            </Button>
          }
        />
      </div>

      <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground">مواعيد اليوم</h2>

      {isLoading ? (
        <EmptyState text="جارٍ التحميل..." />
      ) : appointments.length === 0 ? (
        <EmptyState text="لا توجد مواعيد اليوم" />
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => (
            <Card key={appointment.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{appointment.patients?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(appointment.appointment_time)}
                    {appointment.reason ? ` · ${appointment.reason}` : ""}
                  </p>
                </div>
                <select
                  value={appointment.status}
                  onChange={(e) =>
                    statusMutation.mutate({
                      id: appointment.id,
                      status: e.target.value as AppointmentStatus,
                    })
                  }
                  className="h-9 rounded-xl border border-border bg-background px-2 text-sm text-foreground"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="secondary"
                className="mt-3 h-10 w-full rounded-2xl"
                disabled={arrivalMutation.isPending}
                onClick={() => arrivalMutation.mutate(appointment)}
              >
                تأكيد الوصول
              </Button>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
