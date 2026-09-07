import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { doctorNav } from "@/components/nav-items";
import { createStaff, listStaff, type StaffRole } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/doctor/team")({
  head: () => ({
    meta: [
      { title: "إدارة الفريق | العيادة الذكية" },
      { name: "description", content: "عرض فريق العيادة وإضافة حسابات موظفين جدد." },
      { property: "og:title", content: "إدارة الفريق | العيادة الذكية" },
      { property: "og:description", content: "عرض فريق العيادة وإضافة حسابات موظفين جدد." },
    ],
  }),
  component: TeamPage,
});

const ROLE_LABELS: Record<StaffRole, string> = {
  doctor: "طبيب",
  receptionist: "استقبال",
};

function TeamPage() {
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const addStaff = useServerFn(createStaff);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("receptionist");
  const [error, setError] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetchStaff(),
  });

  const mutation = useMutation({
    mutationFn: () => addStaff({ data: { fullName, email, password, role } }),
    onSuccess: () => {
      toast.success("تم إنشاء الحساب بنجاح");
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("receptionist");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "تعذر إنشاء الحساب";
      setError(message);
      toast.error(message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError("يرجى ملء جميع الحقول، وكلمة المرور 6 أحرف على الأقل.");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <AppShell title="إدارة الفريق" nav={doctorNav}>
      <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" /> فريق العيادة
        </h2>
        {staffQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : staffQuery.error ? (
          <p className="text-sm text-destructive">تعذر تحميل الفريق</p>
        ) : (staffQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد أعضاء بعد.</p>
        ) : (
          <ul className="space-y-2">
            {staffQuery.data!.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/50 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.full_name ?? "بدون اسم"}</p>
                  <p dir="ltr" className="truncate text-right text-xs text-muted-foreground">
                    {member.email ?? "—"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary">
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-primary" /> إضافة عضو جديد
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="name">الاسم الكامل</Label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffEmail">البريد الإلكتروني</Label>
            <Input
              id="staffEmail"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-2xl text-right"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffPassword">كلمة مرور مؤقتة</Label>
            <Input
              id="staffPassword"
              type="text"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-2xl text-right"
            />
          </div>
          <div className="space-y-2">
            <Label>الصلاحية</Label>
            <div className="flex gap-2">
              {(["receptionist", "doctor"] as StaffRole[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-medium transition-colors ${
                    role === option
                      ? "border-primary bg-accent text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {ROLE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}
          <Button type="submit" disabled={mutation.isPending} className="h-11 w-full rounded-2xl text-base">
            {mutation.isPending ? "جارٍ الإنشاء..." : "إضافة العضو"}
          </Button>
        </form>
      </section>
    </AppShell>
  );
}
