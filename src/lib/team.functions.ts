import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffRole = "receptionist" | "doctor";

export type StaffMember = {
  id: string;
  full_name: string | null;
  role: StaffRole;
  email: string | null;
  created_at: string | null;
};

function slugFromName(name: string) {
  const ascii = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
  return ascii.length >= 3 ? ascii : "CLINIC";
}

/** Public: registers a brand-new clinic plus its owner (doctor) account. */
export const signupClinic = createServerFn({ method: "POST" })
  .inputValidator((input: { clinicName: string; fullName: string; email: string; password: string }) => {
    const clinicName = input.clinicName?.trim() ?? "";
    const fullName = input.fullName?.trim() ?? "";
    const email = input.email?.trim().toLowerCase() ?? "";
    const password = input.password ?? "";
    if (clinicName.length < 2) throw new Error("اسم العيادة مطلوب");
    if (fullName.length < 2) throw new Error("الاسم الكامل مطلوب");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("بريد إلكتروني غير صالح");
    if (password.length < 6) throw new Error("كلمة المرور يجب ألا تقل عن 6 أحرف");
    return { clinicName, fullName, email, password };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const base = slugFromName(data.clinicName);
    let clinicId: string | null = null;
    let clinicCode = "";
    for (let attempt = 0; attempt < 6 && !clinicId; attempt++) {
      clinicCode = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: clinic, error } = await supabaseAdmin
        .from("clinics")
        .insert({ name: data.clinicName, clinic_code: clinicCode })
        .select("id")
        .maybeSingle();
      if (!error && clinic) clinicId = clinic.id;
      else if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw new Error(error.message);
    }
    if (!clinicId) throw new Error("تعذر إنشاء كود العيادة، حاول مرة أخرى");

    const { error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        role: "doctor",
        clinic_id: clinicId,
        clinic_code: clinicCode,
      },
    });

    if (userError) {
      await supabaseAdmin.from("clinics").delete().eq("id", clinicId);
      const message = `${userError.message}`.toLowerCase();
      throw new Error(
        message.includes("already") ? "هذا البريد الإلكتروني مسجل بالفعل" : "تعذر إنشاء الحساب",
      );
    }

    return { clinicId, clinicCode };
  });

async function requireDoctorClinic(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", context.userId)
    .maybeSingle();
  if (error || !data?.clinic_id || data.role !== "doctor") throw new Error("غير مصرح");
  return data.clinic_id as string;
}

/** Staff list for the caller's own clinic. */
export const listStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffMember[]> => {
    const clinicId = await requireDoctorClinic(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? null]));

    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role as StaffRole,
      created_at: p.created_at,
      email: emails.get(p.id) ?? null,
    }));
  });

/** Creates a staff account inside the caller's clinic. clinic_id is never taken from the client. */
export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string; email: string; password: string; role: StaffRole }) => {
    const fullName = input.fullName?.trim() ?? "";
    const email = input.email?.trim().toLowerCase() ?? "";
    const password = input.password ?? "";
    const role: StaffRole = input.role === "doctor" ? "doctor" : "receptionist";
    if (fullName.length < 2) throw new Error("الاسم الكامل مطلوب");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("بريد إلكتروني غير صالح");
    if (password.length < 6) throw new Error("كلمة المرور يجب ألا تقل عن 6 أحرف");
    return { fullName, email, password, role };
  })
  .handler(async ({ data, context }) => {
    const clinicId = await requireDoctorClinic(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: data.role, clinic_id: clinicId },
    });
    if (error || !created.user) {
      const message = `${error?.message ?? ""}`.toLowerCase();
      throw new Error(message.includes("already") ? "هذا البريد الإلكتروني مسجل بالفعل" : "تعذر إنشاء الحساب");
    }

    // Guarantee the profile matches the caller's clinic even if the trigger fell back.
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: created.user.id, clinic_id: clinicId, role: data.role, full_name: data.fullName },
        { onConflict: "id" },
      );

    return { id: created.user.id };
  });
