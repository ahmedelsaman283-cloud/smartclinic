import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/staff")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دخول الموظفين | العيادة الذكية" },
      { name: "description", content: "تسجيل دخول موظفي العيادة الذكية: الاستقبال والطبيب." },
      { property: "og:title", content: "دخول الموظفين | العيادة الذكية" },
      { property: "og:description", content: "تسجيل دخول موظفي العيادة الذكية: الاستقبال والطبيب." },
    ],
  }),
  component: StaffAuth,
});

async function routeByRole(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || !data.clinic_id) return null;
  return data.role as "receptionist" | "doctor";
}


function StaffAuth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      const role = await routeByRole(data.user.id);
      if (role === "receptionist") navigate({ to: "/reception", replace: true });
      if (role === "doctor") navigate({ to: "/doctor", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setError("بيانات الدخول غير صحيحة");
      setLoading(false);
      return;
    }
    const role = await routeByRole(data.user.id);
    if (role === "receptionist") {
      navigate({ to: "/reception", replace: true });
    } else if (role === "doctor") {
      navigate({ to: "/doctor", replace: true });
    } else {
      await supabase.auth.signOut();
      setError("لا توجد صلاحية مرتبطة بهذا الحساب. تواصل مع المسؤول.");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border/70 bg-card p-6 shadow-[0_12px_40px_oklch(0.55_0.05_255/0.10)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">العيادة الذكية</h1>
          <p className="mt-1 text-sm text-muted-foreground">دخول الموظفين</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-2xl text-right"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>
          {error ? (
            <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-2xl text-base">
            {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          الحسابات تُنشأ بواسطة مسؤول النظام فقط.
        </p>
      </div>
    </div>
  );
}
