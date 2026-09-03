import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { receptionNav } from "@/components/nav-items";
import { WalkInDialog } from "@/components/walkin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  STATUS_LABELS,
  STATUS_OPTIONS,
  formatTime,
  todayISO,
  type AppointmentStatus,
  type AppointmentWithPatient,
} from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/reception/appointments")({
  head: () => ({
    meta: [
      { title: "المواعيد | استقبال العيادة الذكية" },
      { name: "description", content: "إدارة مواعيد العيادة حسب اليوم وتحديث حالات المرضى." },
      { property: "og:title", content: "المواعيد | استقبال العيادة الذكية" },
      { property: "og:description", content: "إدارة مواعيد العيادة حسب اليوم وتحديث حالات المرضى." },
    ],
  }),
  component: ReceptionAppointments,
});

function ReceptionAppointments() {
  const [date, setDate] = useState(todayISO());
  const queryClient = useQueryClient();

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", "byDate", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(id, full_name, phone)")
        .eq("appointment_date", date)
        .order("appointment_time", { ascending: true });
      if (error) throw error;
      return data as unknown as AppointmentWithPatient[];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    onError: () => toast.error("تعذر تحديث الحالة"),
  });

  return (
    <AppShell
      title="المواعيد"
      nav={receptionNav}
      action={
        <WalkInDialog
          trigger={
            <Button size="sm" className="h-9 rounded-full">
              <CalendarPlus className="ms-1 h-4 w-4" />
              فوري
            </Button>
          }
        />
      }
    >
      <div className="mb-4">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 rounded-2xl"
        />
      </div>

      {appointments.length === 0 ? (
        <EmptyState text="لا توجد مواعيد في هذا اليوم" />
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => (
            <Card key={appointment.id} className="flex items-center justify-between gap-3">
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
                  statusMutation.mutate({ id: appointment.id, status: e.target.value as AppointmentStatus })
                }
                className="h-9 rounded-xl border border-border bg-background px-2 text-sm"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
