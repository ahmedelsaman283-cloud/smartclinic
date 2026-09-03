import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "العيادة الذكية | نظام إدارة العيادة" },
      { name: "description", content: "نظام داخلي لإدارة المرضى والمواعيد والفواتير في العيادة." },
      { property: "og:title", content: "العيادة الذكية | نظام إدارة العيادة" },
      {
        property: "og:description",
        content: "نظام داخلي لإدارة المرضى والمواعيد والفواتير في العيادة.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth/staff" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.role === "doctor") throw redirect({ to: "/doctor" });
    if (profile?.role === "receptionist") throw redirect({ to: "/reception" });
    throw redirect({ to: "/auth/staff" });
  },
  component: () => null,
});
