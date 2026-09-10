import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/app-shell";
import { formatMoney, todayISO } from "@/lib/clinic";

function isoDate(d: Date) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date(`${todayISO()}T00:00:00`);
  d.setDate(1);
  return isoDate(d);
}

function weekStart() {
  const d = new Date(`${todayISO()}T00:00:00`);
  const diff = (d.getDay() + 1) % 7; // week starts Saturday
  d.setDate(d.getDate() - diff);
  return isoDate(d);
}

function lastSevenDays() {
  const days: string[] = [];
  const base = new Date(`${todayISO()}T00:00:00`);
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    days.push(isoDate(d));
  }
  return days;
}

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function useOperationalStats() {
  const from = monthStart();
  const to = todayISO();
  const week = weekStart();
  const days = lastSevenDays();
  const sevenFrom = days[0];

  return useQuery({
    queryKey: ["operational-dashboard", from, to],
    queryFn: async () => {
      const [patientsRes, monthApptRes, weekApptRes, weekVisitsRes, invoicesRes] =
        await Promise.all([
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .gte("created_at", `${from}T00:00:00`)
            .lte("created_at", `${to}T23:59:59.999`),
          supabase
            .from("appointments")
            .select("status")
            .gte("appointment_date", from)
            .lte("appointment_date", to),
          supabase
            .from("appointments")
            .select("status")
            .gte("appointment_date", week)
            .lte("appointment_date", to),
          supabase
            .from("appointments")
            .select("appointment_date, status")
            .gte("appointment_date", sevenFrom)
            .lte("appointment_date", to),
          supabase
            .from("invoices")
            .select("created_at, invoice_items(service, price)")
            .eq("payment_status", "paid")
            .gte("created_at", `${from}T00:00:00`)
            .lte("created_at", `${to}T23:59:59.999`),
        ]);

      for (const res of [patientsRes, monthApptRes, weekApptRes, weekVisitsRes, invoicesRes]) {
        if (res.error) throw res.error;
      }

      const monthAppts = (monthApptRes.data ?? []) as { status: string }[];
      const weekAppts = (weekApptRes.data ?? []) as { status: string }[];
      const noShow = monthAppts.filter((a) => a.status === "no_show").length;
      const noShowRate = monthAppts.length ? Math.round((noShow / monthAppts.length) * 100) : 0;

      const items = (
        (invoicesRes.data ?? []) as {
          invoice_items: { service: string; price: number | null }[] | null;
        }[]
      ).flatMap((inv) => inv.invoice_items ?? []);
      const revenue = items.reduce((sum, i) => sum + Number(i.price ?? 0), 0);

      const counts = new Map<string, number>();
      for (const item of items) {
        counts.set(item.service, (counts.get(item.service) ?? 0) + 1);
      }
      const topServices = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([service, count]) => ({ service, count }));

      const visits = (weekVisitsRes.data ?? []) as { appointment_date: string; status: string }[];
      const chart = days.map((day) => ({
        day,
        label: WEEKDAYS[new Date(`${day}T00:00:00`).getDay()],
        count: visits.filter((v) => v.appointment_date === day && v.status !== "cancelled").length,
      }));

      return {
        newPatients: patientsRes.count ?? 0,
        weekTotal: weekAppts.length,
        weekConfirmed: weekAppts.filter((a) => a.status !== "cancelled" && a.status !== "no_show")
          .length,
        weekCancelled: weekAppts.filter((a) => a.status === "cancelled").length,
        noShowRate,
        noShow,
        revenue,
        topServices,
        chart,
      };
    },
  });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-primary">{value}</p>
    </div>
  );
}

export function OperationalDashboard() {
  const { data, isLoading } = useOperationalStats();
  const dash = isLoading ? "..." : undefined;

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">لوحة التشغيل — هذا الشهر</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="مرضى جدد" value={dash ?? data?.newPatients ?? 0} />
          <Stat label="إيرادات مدفوعة" value={dash ?? formatMoney(data?.revenue ?? 0)} />
          <Stat label="نسبة عدم الحضور" value={dash ?? `${data?.noShowRate ?? 0}%`} />
          <Stat label="حالات لم تحضر" value={dash ?? data?.noShow ?? 0} />
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">مواعيد هذا الأسبوع</p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="الإجمالي" value={dash ?? data?.weekTotal ?? 0} />
          <Stat label="مؤكدة" value={dash ?? data?.weekConfirmed ?? 0} />
          <Stat label="ملغية" value={dash ?? data?.weekCancelled ?? 0} />
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">أكثر 3 خدمات طلبًا هذا الشهر</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : (data?.topServices.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
        ) : (
          <ul className="space-y-2">
            {data?.topServices.map((item, index) => (
              <li
                key={item.service}
                className="flex items-center justify-between rounded-2xl bg-secondary/60 px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  {index + 1}. {item.service}
                </span>
                <span className="font-bold text-primary">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">الزيارات خلال آخر 7 أيام</p>
        <div className="h-56 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.chart ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={24}
                fontSize={11}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--secondary))" }}
                labelFormatter={(label) => `${label}`}
                formatter={(value) => [`${value}`, "زيارات"]}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
