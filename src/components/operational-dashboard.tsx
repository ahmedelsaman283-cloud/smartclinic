import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarCheck2,
  ChartNoAxesCombined,
  CircleDollarSign,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: typeof Activity;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/50 bg-secondary/45 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-3 break-words text-xl font-extrabold text-foreground">{value}</p>
    </div>
  );
}

export function OperationalDashboard() {
  const { data, isLoading } = useOperationalStats();
  const dash = isLoading ? "..." : undefined;

  return (
    <section className="space-y-5" aria-labelledby="operations-title">
      <div className="flex items-end justify-between gap-3 px-1 pt-1">
        <div>
          <h2 id="operations-title" className="text-lg font-bold text-foreground">
            مؤشرات التشغيل
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">أداء العيادة خلال الفترة الحالية</p>
        </div>
        <ChartNoAxesCombined className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-foreground">ملخص هذا الشهر</p>
          <span className="text-xs text-muted-foreground">حتى اليوم</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="مرضى جدد" value={dash ?? data?.newPatients ?? 0} icon={UserPlus} />
          <Stat
            label="إيرادات مدفوعة"
            value={dash ?? formatMoney(data?.revenue ?? 0)}
            icon={CircleDollarSign}
          />
          <Stat
            label="نسبة عدم الحضور"
            value={dash ?? `${data?.noShowRate ?? 0}%`}
            icon={Activity}
          />
          <Stat label="حالات لم تحضر" value={dash ?? data?.noShow ?? 0} icon={CalendarCheck2} />
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <CalendarCheck2 className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-bold text-foreground">مواعيد هذا الأسبوع</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="الإجمالي" value={dash ?? data?.weekTotal ?? 0} />
          <Stat label="مؤكدة" value={dash ?? data?.weekConfirmed ?? 0} />
          <Stat label="ملغية" value={dash ?? data?.weekCancelled ?? 0} />
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-bold text-foreground">أكثر 3 خدمات طلبًا هذا الشهر</p>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : (data?.topServices.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
        ) : (
          <ul className="space-y-2">
            {data?.topServices.map((item, index) => (
              <li
                key={item.service}
                className="flex items-center justify-between rounded-2xl border border-border/50 bg-secondary/45 px-4 py-3 text-sm"
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

      <Card className="space-y-5 overflow-hidden p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">الزيارات خلال آخر 7 أيام</p>
            <p className="mt-1 text-xs text-muted-foreground">عدد الزيارات اليومية المسجلة</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data?.chart ?? []}
              margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickMargin={12}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(3, dataMax + 1)]}
                tickLine={false}
                axisLine={false}
                width={24}
                fontSize={11}
                tickMargin={8}
                stroke="var(--muted-foreground)"
              />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  color: "var(--popover-foreground)",
                }}
                labelFormatter={(label) => `${label}`}
                formatter={(value) => [`${value}`, "زيارات"]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--primary)"
                strokeWidth={3}
                fill="url(#visitsFill)"
                dot={{ r: 4, fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}
