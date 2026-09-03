import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { doctorNav } from "@/components/nav-items";
import {
  STATUS_LABELS,
  formatDate,
  formatTime,
  todayISO,
  type AppointmentWithPatient,
} from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/doctor/")({
  head: () => ({
    meta: [
      { title: "قائمة اليوم | طبيب العيادة الذكية" },
      { name: "description", content: "قائمة انتظار مرضى اليوم مع المريض الحالي بشكل مباشر." },
      { property: "og:title", content: "قائمة اليوم | طبيب العيادة الذكية" },
      { property: "og:description", content: "قائمة انتظار مرضى اليوم مع المريض الحالي بشكل مباشر." },
    ],
  }),
  component: DoctorQueue,
});

function DoctorQueue() {
  const queryClient = useQueryClient();
  const today = todayISO();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", "queue", today],
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
      .channel("doctor-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const current = appointments.find((a) => a.status === "with_doctor") ?? null;
  const waiting = appointments.filter((a) => a.id !== current?.id && a.status === "waiting");
  const others = appointments.filter(
    (a) => a.id !== current?.id && a.status !== "waiting",
  );

  return (
    <AppShell title="قائمة اليوم" subtitle={formatDate(today)} nav={doctorNav}>
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">المريض الحالي</h2>
      {current ? (
        <Link to="/doctor/patient/$id" params={{ id: current.patient_id }} className="block">
          <div className="rounded-3xl border-2 border-primary bg-accent p-5 shadow-[0_10px_30px_oklch(0.55_0.15_255/0.18)]">
            <p className="text-xl font-bold text-accent-foreground">
              {current.patients?.full_name ?? "—"}
            </p>
            <p className="mt-1 text-sm text-accent-foreground/80">
              {formatTime(current.appointment_time)}
              {current.reason ? ` · ${current.reason}` : ""}
            </p>
            <p className="mt-3 text-xs font-medium text-primary">فتح ملف المريض ←</p>
          </div>
        </Link>
      ) : (
        <EmptyState text="لا يوجد مريض في الكشف حالياً" />
      )}

      <h2 className="mt-6 mb-2 px-1 text-sm font-semibold text-muted-foreground">قائمة الانتظار</h2>
      {isLoading ? (
        <EmptyState text="جارٍ التحميل..." />
      ) : waiting.length === 0 ? (
        <EmptyState text="لا يوجد مرضى في الانتظار" />
      ) : (
        <div className="space-y-3">
          {waiting.map((appointment) => (
            <Link
              key={appointment.id}
              to="/doctor/patient/$id"
              params={{ id: appointment.patient_id }}
              className="block"
            >
              <Card className="flex items-center justify-between">
                <span className="font-medium">{appointment.patients?.full_name ?? "—"}</span>
                <span className="text-sm text-muted-foreground">
                  {formatTime(appointment.appointment_time)}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {others.length > 0 ? (
        <>
          <h2 className="mt-6 mb-2 px-1 text-sm font-semibold text-muted-foreground">مواعيد أخرى اليوم</h2>
          <div className="space-y-2">
            {others.map((appointment) => (
              <Link
                key={appointment.id}
                to="/doctor/patient/$id"
                params={{ id: appointment.patient_id }}
                className="block"
              >
                <Card className="flex items-center justify-between opacity-70">
                  <span className="font-medium">{appointment.patients?.full_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(appointment.appointment_time)} · {STATUS_LABELS[appointment.status]}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
