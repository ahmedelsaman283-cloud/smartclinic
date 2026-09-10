import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { receptionNav } from "@/components/nav-items";
import { RangeCard } from "@/components/accounts-summary";
import { OperationalDashboard } from "@/components/operational-dashboard";
import { formatDate, todayISO } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/reception/accounts")({
  head: () => ({
    meta: [
      { title: "الحسابات | استقبال العيادة الذكية" },
      { name: "description", content: "إيرادات اليوم وعدد المرضى في العيادة الذكية." },
      { property: "og:title", content: "الحسابات | استقبال العيادة الذكية" },
      { property: "og:description", content: "إيرادات اليوم وعدد المرضى في العيادة الذكية." },
    ],
  }),
  component: ReceptionAccounts,
});

function ReceptionAccounts() {
  return (
    <AppShell title="الحسابات" subtitle={formatDate(todayISO())} nav={receptionNav}>
      <div className="space-y-3">
        <RangeCard range="today" />
        <OperationalDashboard />
      </div>
    </AppShell>
  );
}
