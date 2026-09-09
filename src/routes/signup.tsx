import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signupClinic } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل عيادة جديدة | العيادة الذكية" },
      { name: "description", content: "أنشئ حساب عيادتك على العيادة الذكية وابدأ إدارة المرضى والمواعيد." },
      { property: "og:title", content: "تسجيل عيادة جديدة | العيادة الذكية" },
      {
        property: "og:description",
        content: "أنشئ حساب عيادتك على العيادة الذكية وابدأ إدارة المرضى والمواعيد.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const register = useServerFn(signupClinic);
  const [clinicName, setClinicName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clinicName.trim() || !fullName.trim() || !email.trim() || password.length < 6) {
      setError("يرجى ملء جميع الحقول، وكلمة المرور 6 أحرف على الأقل.");
      return;
    }
    setLoading(true);
    try {
      await register({ data: { clinicName, fullName, email, password } });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw new Error("تم إنشاء الحساب، لكن تعذر الدخول. جرّب تسجيل الدخول.");
      navigate({ to: "/doctor", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border/70 bg-card p-6 shadow-[0_12px_40px_oklch(0.55_0.05_255/0.10)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">تسجيل عيادة جديدة</h1>
          <p className="mt-1 text-sm text-muted-foreground">أنشئ حساب عيادتك وابدأ خلال دقيقة</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicName">اسم العيادة</Label>
            <Input
              id="clinicName"
              required
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">الاسم الكامل</Label>
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>
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
            {loading ? "جارٍ الإنشاء..." : "إنشاء العيادة"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          لديك حساب بالفعل؟{" "}
          <Link to="/auth/staff" className="font-medium text-primary">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
