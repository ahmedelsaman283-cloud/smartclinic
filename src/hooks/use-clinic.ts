import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Clinic = {
  id: string;
  name: string;
  clinic_code: string;
};

/** Current staff member's clinic (RLS limits visibility to their own clinic). */
export function useClinic() {
  return useQuery({
    queryKey: ["clinic"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Clinic | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("id", userId)
        .maybeSingle();
      if (profileError || !profile?.clinic_id) return null;

      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, clinic_code")
        .eq("id", profile.clinic_id)
        .maybeSingle();
      if (error) throw error;
      return data as Clinic | null;
    },
  });
}
