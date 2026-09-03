import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayISO, type Patient } from "@/lib/clinic";

export function WalkInDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const { data: patients = [] } = useQuery({
    queryKey: ["patients", "walkin", search],
    enabled: open && mode === "existing",
    queryFn: async () => {
      let query = supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(20);
      if (search.trim()) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Patient[];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      let targetId = patientId;
      if (mode === "new") {
        const { data, error } = await supabase
          .from("patients")
          .insert({ full_name: newName, phone: newPhone || null })
          .select()
          .single();
        if (error) throw error;
        targetId = data.id;
      }
      if (!targetId) throw new Error("no patient");
      const { error: apptError } = await supabase.from("appointments").insert({
        patient_id: targetId,
        appointment_date: todayISO(),
        appointment_time: time,
        status: "waiting",
        reason: reason || null,
      });
      if (apptError) throw apptError;
    },
    onSuccess: () => {
      toast.success("تم حجز الموعد");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setOpen(false);
      setReason("");
      setPatientId("");
      setNewName("");
      setNewPhone("");
    },
    onError: () => toast.error("تعذر حجز الموعد"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto rounded-3xl text-right sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">حجز موعد فوري</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "existing" ? "default" : "outline"}
            className="flex-1 rounded-2xl"
            onClick={() => setMode("existing")}
          >
            مريض حالي
          </Button>
          <Button
            type="button"
            variant={mode === "new" ? "default" : "outline"}
            className="flex-1 rounded-2xl"
            onClick={() => setMode("new")}
          >
            مريض جديد
          </Button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {mode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="search">ابحث بالاسم أو الهاتف</Label>
              <Input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 rounded-2xl"
              />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border p-1">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPatientId(p.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                      patientId === p.id ? "bg-accent text-accent-foreground" : "hover:bg-secondary"
                    }`}
                  >
                    <span>{p.full_name}</span>
                    <span dir="ltr" className="text-xs text-muted-foreground">
                      {p.phone ?? "—"}
                    </span>
                  </button>
                ))}
                {patients.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">لا توجد نتائج</p>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new_name">اسم المريض</Label>
                <Input
                  id="new_name"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_phone">رقم الهاتف</Label>
                <Input
                  id="new_phone"
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="h-11 rounded-2xl text-right"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="time">وقت الموعد</Label>
            <Input
              id="time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">سبب الزيارة (اختياري)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || (mode === "existing" && !patientId)}
              className="h-11 w-full rounded-2xl"
            >
              {mutation.isPending ? "جارٍ الحجز..." : "حجز الموعد"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
