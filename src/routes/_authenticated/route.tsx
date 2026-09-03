import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth/staff" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth/staff" });
    }
    return { user: data.user, role: profile.role as "receptionist" | "doctor" };
  },
  component: () => <Outlet />,
});
