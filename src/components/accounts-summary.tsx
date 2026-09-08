import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/app-shell";
import { formatMoney, todayISO } from "@/lib/clinic";

export type RangeKey = "today" | "week" | "month";

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "اليوم",
  week: "هذا الأسبوع",
  month: "هذا الشهر",
};

function rangeStart(range: RangeKey) {
  const today = new Date(`${todayISO()}T00:00:00`);
  if (range === "today") return todayISO();
  if (range === "week") {
    const day = today.getDay(); // 0 = Sunday
    const diff = (day + 1) % 7; // week starts Saturday
    today.setDate(today.getDate() - diff);
  } else {
    today.setDate(1);
  }
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function useRangeStats(range: RangeKey) {
  const from = rangeStart(range);
  const to = todayISO();

  return useQuery({
    queryKey: ["accounts", range, from, to],
    queryFn: async () => {
      const [invoicesRes, appointmentsRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("created_at, invoice_items(price)")
          .eq("payment_status", "paid")
          .gte("created_at", `${from}T00:00:00`)
          .lte("created_at", `${to}T23:59:59.999`),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .neq("status", "cancelled")
          .gte("appointment_date", from)
          .lte("appointment_date", to),
      ]);
      if (invoicesRes.error) throw invoicesRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;
      const revenue = (invoicesRes.data ?? []).reduce(
        (sum, row) =>
          sum + ((row.invoice_items ?? []) as { price: number | null }[]).reduce((s, i) => s + Number(i.price ?? 0), 0),
        0,
      );
      return { revenue, patients: appointmentsRes.count ?? 0 };
    },
  });
}

export function RangeCard({ range }: { range: RangeKey }) {
  const { data, isLoading } = useRangeStats(range);

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-muted-foreground">{RANGE_LABELS[range]}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-secondary/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
          <p className="mt-1 text-lg font-bold text-primary">
            {isLoading ? "..." : formatMoney(data?.revenue ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">عدد المرضى</p>
          <p className="mt-1 text-lg font-bold text-foreground">{isLoading ? "..." : data?.patients ?? 0}</p>
        </div>
      </div>
    </Card>
  );
}
