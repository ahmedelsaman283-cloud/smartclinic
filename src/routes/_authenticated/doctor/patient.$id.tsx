import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Download, FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/use-clinic";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { doctorNav } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatTime,
  todayISO,
  type Appointment,
  type Patient,
} from "@/lib/clinic";

type PatientFile = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  created_at: string;
};


export const Route = createFileRoute("/_authenticated/doctor/patient/$id")({
  head: () => ({
    meta: [
      { title: "ملف المريض | طبيب العيادة الذكية" },
      { name: "description", content: "بيانات المريض والسجل الطبي وملاحظات زيارة اليوم." },
      { property: "og:title", content: "ملف المريض | طبيب العيادة الذكية" },
      { property: "og:description", content: "بيانات المريض والسجل الطبي وملاحظات زيارة اليوم." },
    ],
  }),
  component: PatientFile,
});

function PatientFile() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const today = todayISO();
  const [diagnosis, setDiagnosis] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [notes, setNotes] = useState("");

  const { data: patient } = useQuery({
    queryKey: ["patients", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Patient | null;
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", "patient", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", id)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const todayVisit = appointments.find((a) => a.appointment_date === today) ?? null;
  const history = appointments.filter((a) => a.id !== todayVisit?.id);

  useEffect(() => {
    setDiagnosis(todayVisit?.diagnosis ?? "");
    setTreatmentPlan(todayVisit?.treatment_plan ?? "");
    setNotes(todayVisit?.notes ?? "");
  }, [todayVisit?.id, todayVisit?.diagnosis, todayVisit?.treatment_plan, todayVisit?.notes]);

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!todayVisit) throw new Error("no visit");
      const { error } = await supabase
        .from("appointments")
        .update({ diagnosis, treatment_plan: treatmentPlan, notes })
        .eq("id", todayVisit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الملاحظات");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: () => toast.error("تعذر حفظ الملاحظات"),
  });

  const { data: clinic } = useClinic();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files = [] } = useQuery({
    queryKey: ["patient-files", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_files")
        .select("id, file_name, file_url, file_type, created_at")
        .eq("patient_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PatientFile[];
    },
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!clinic?.id) throw new Error("no clinic");
      const { data: userData } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `${clinic.id}/${id}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
      const { error: uploadError } = await supabase.storage
        .from("patient-files")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("patient_files").insert({
        patient_id: id,
        clinic_id: clinic.id,
        file_name: file.name,
        file_url: path,
        file_type: file.type.startsWith("image/") ? "image" : ext === "pdf" ? "pdf" : "file",
        uploaded_by: userData.user?.id ?? null,
      });
      if (error) {
        await supabase.storage.from("patient-files").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم رفع الملف");
      queryClient.invalidateQueries({ queryKey: ["patient-files", id] });
    },
    onError: () => toast.error("تعذر رفع الملف"),
  });

  const deleteFile = useMutation({
    mutationFn: async (file: PatientFile) => {
      const { error } = await supabase.from("patient_files").delete().eq("id", file.id);
      if (error) throw error;
      await supabase.storage.from("patient-files").remove([file.file_url]);
    },
    onSuccess: () => {
      toast.success("تم حذف الملف");
      queryClient.invalidateQueries({ queryKey: ["patient-files", id] });
    },
    onError: () => toast.error("تعذر حذف الملف"),
  });

  async function openFile(file: PatientFile) {
    const { data, error } = await supabase.storage
      .from("patient-files")
      .createSignedUrl(file.file_url, 60, { download: file.file_name });
    if (error || !data?.signedUrl) {
      toast.error("تعذر فتح الملف");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }


  return (
    <AppShell
      title="ملف المريض"
      nav={doctorNav}
      action={
        <Link
          to="/doctor"
          className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs text-muted-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </Link>
      }
    >
      <Card className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">البيانات الأساسية</h2>
        <p className="text-xl font-bold">{patient?.full_name ?? "—"}</p>
        <p dir="ltr" className="text-right text-sm text-muted-foreground">
          {patient?.phone ?? "—"}
        </p>
        <p className="text-sm text-muted-foreground">
          تاريخ الميلاد: {patient?.date_of_birth ? formatDate(patient.date_of_birth) : "—"}
        </p>
      </Card>

      <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground">السجل</h2>
      {history.length === 0 ? (
        <EmptyState text="لا توجد زيارات سابقة" />
      ) : (
        <ol className="relative space-y-3 border-e-2 border-border pe-4">
          {history.map((visit) => (
            <li key={visit.id} className="relative">
              <span className="absolute -end-[21px] top-4 h-2.5 w-2.5 rounded-full bg-primary" />
              <Card>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{formatDate(visit.appointment_date)}</p>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(visit.appointment_time)} · {STATUS_LABELS[visit.status]}
                  </span>
                </div>
                {visit.reason ? (
                  <p className="mt-1 text-xs text-muted-foreground">سبب الزيارة: {visit.reason}</p>
                ) : null}
                <div className="mt-3 space-y-3">
                  <VisitField label="التشخيص" value={visit.diagnosis} />
                  <VisitField label="الخطة العلاجية" value={visit.treatment_plan} />
                  <VisitField label="ملاحظات إضافية" value={visit.notes} />
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <h2 className="mt-6 mb-3 px-1 text-sm font-semibold text-muted-foreground">زيارة اليوم</h2>
      <Card>
        {todayVisit ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {formatTime(todayVisit.appointment_time)} · {STATUS_LABELS[todayVisit.status]}
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold">التشخيص</label>
                <Textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={4}
                  placeholder="اكتب التشخيص الطبي..."
                  className="rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">الخطة العلاجية</label>
                <Textarea
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  rows={4}
                  placeholder="الأدوية والجرعات وتعليمات العلاج..."
                  className="rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">ملاحظات إضافية</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="أي ملاحظات أخرى..."
                  className="rounded-2xl"
                />
              </div>
            </div>
            <Button
              className="mt-4 h-11 w-full rounded-2xl"
              disabled={saveNotes.isPending}
              onClick={() => saveNotes.mutate()}
            >
              {saveNotes.isPending ? "جارٍ الحفظ..." : "حفظ الملاحظات"}
            </Button>

          </>
        ) : (
          <p className="text-sm text-muted-foreground">لا يوجد موعد لهذا المريض اليوم.</p>
        )}
      </Card>
    </AppShell>
  );
}

function VisitField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-primary">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
