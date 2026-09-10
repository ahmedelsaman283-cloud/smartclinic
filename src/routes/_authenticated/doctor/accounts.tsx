import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { doctorNav } from "@/components/nav-items";
import { AccountsOverview } from "@/components/accounts-summary";
import { OperationalDashboard } from "@/components/operational-dashboard";
import { formatDate, todayISO } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/doctor/accounts")({
  head: () => ({
    meta: [
      { title: "الحسابات | طبيب العيادة الذكية" },
      { name: "description", content: "إيرادات وعدد المرضى لليوم والأسبوع والشهر." },
      { property: "og:title", content: "الحسابات | طبيب العيادة الذكية" },
      { property: "og:description", content: "إيرادات وعدد المرضى لليوم والأسبوع والشهر." },
    ],
  }),
  component: DoctorAccounts,
});

function DoctorAccounts() {
  return (
    <AppShell title="الحسابات" subtitle={formatDate(todayISO())} nav={doctorNav}>
      <div className="space-y-5">
        <AccountsOverview ranges={["today", "week", "month"]} />
        <OperationalDashboard />
      </div>
    </AppShell>
  );
}
