import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { doctorNav } from "@/components/nav-items";
import { Input } from "@/components/ui/input";
import type { Patient } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/doctor/patients")({
  head: () => ({
    meta: [
      { title: "المرضى | طبيب العيادة الذكية" },
      { name: "description", content: "البحث عن أي مريض لعرض سجله الطبي الكامل." },
      { property: "og:title", content: "المرضى | طبيب العيادة الذكية" },
      { property: "og:description", content: "البحث عن أي مريض لعرض سجله الطبي الكامل." },
    ],
  }),
  component: DoctorPatients,
});

function DoctorPatients() {
  const [search, setSearch] = useState("");

  const { data: patients = [] } = useQuery({
    queryKey: ["patients", "doctor", search],
    queryFn: async () => {
      let query = supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(50);
      if (search.trim()) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Patient[];
    },
  });

  return (
    <AppShell title="المرضى" nav={doctorNav}>
      <div className="relative mb-4">
        <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف"
          className="h-12 rounded-2xl pe-10"
        />
      </div>

      {patients.length === 0 ? (
        <EmptyState text="لا توجد نتائج" />
      ) : (
        <div className="space-y-2">
          {patients.map((patient) => (
            <Link key={patient.id} to="/doctor/patient/$id" params={{ id: patient.id }} className="block">
              <Card className="flex items-center justify-between">
                <span className="font-medium">{patient.full_name}</span>
                <span dir="ltr" className="text-sm text-muted-foreground">
                  {patient.phone ?? "—"}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
