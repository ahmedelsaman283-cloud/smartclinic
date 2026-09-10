import { useQuery } from "@tanstack/react-query";
import { CalendarDays, UsersRound, WalletCards } from "lucide-react";
import { useState } from "react";
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
          sum +
          ((row.invoice_items ?? []) as { price: number | null }[]).reduce(
            (s, i) => s + Number(i.price ?? 0),
            0,
          ),
        0,
      );
      return { revenue, patients: appointmentsRes.count ?? 0 };
    },
  });
}

function RangeMetrics({ range }: { range: RangeKey }) {
  const { data, isLoading } = useRangeStats(range);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="min-w-0 rounded-2xl border border-border/60 bg-secondary/45 p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground sm:text-sm">إجمالي الإيرادات</p>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WalletCards className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="break-words text-xl font-extrabold text-primary sm:text-2xl">
          {isLoading ? "..." : formatMoney(data?.revenue ?? 0)}
        </p>
      </div>
      <div className="min-w-0 rounded-2xl border border-border/60 bg-secondary/45 p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground sm:text-sm">عدد المرضى</p>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="text-2xl font-extrabold text-foreground sm:text-3xl">
          {isLoading ? "..." : (data?.patients ?? 0)}
        </p>
      </div>
    </div>
  );
}

export function AccountsOverview({ ranges }: { ranges: RangeKey[] }) {
  const [activeRange, setActiveRange] = useState<RangeKey>(ranges[0] ?? "today");

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold text-foreground">نظرة عامة</p>
          <p className="mt-1 text-xs text-muted-foreground">ملخص الإيرادات وحركة المرضى</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      {ranges.length > 1 ? (
        <div
          className="grid grid-cols-3 rounded-2xl bg-secondary/70 p-1"
          role="tablist"
          aria-label="الفترة الزمنية"
        >
          {ranges.map((range) => (
            <button
              key={range}
              type="button"
              role="tab"
              aria-selected={activeRange === range}
              onClick={() => setActiveRange(range)}
              className={`min-h-10 rounded-xl px-2 text-xs font-bold transition-all sm:text-sm ${
                activeRange === range
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      ) : (
        <p className="border-b border-border/60 pb-3 text-sm font-semibold text-primary">
          {RANGE_LABELS[activeRange]}
        </p>
      )}

      <RangeMetrics range={activeRange} />
    </Card>
  );
}
