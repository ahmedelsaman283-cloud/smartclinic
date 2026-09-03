import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import type { Patient } from "@/lib/clinic";

export function AddPatientDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: (patient: Patient) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .insert({ full_name: fullName, phone: phone || null, date_of_birth: dob || null })
        .select()
        .single();
      if (error) throw error;
      return data as Patient;
    },
    onSuccess: (patient) => {
      toast.success("تم إضافة المريض");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setFullName("");
      setPhone("");
      setDob("");
      setOpen(false);
      onCreated?.(patient);
    },
    onError: () => toast.error("تعذر إضافة المريض"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent dir="rtl" className="rounded-3xl text-right sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">إضافة مريض جديد</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="full_name">الاسم الكامل</Label>
            <Input
              id="full_name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-2xl text-right"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">تاريخ الميلاد</Label>
            <Input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending} className="h-11 w-full rounded-2xl">
              {mutation.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
