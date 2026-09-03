import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { receptionNav } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Invoice } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/reception/invoices")({
  head: () => ({
    meta: [
      { title: "الفواتير | استقبال العيادة الذكية" },
      { name: "description", content: "متابعة فواتير المرضى وتحديث الخدمة والسعر وحالة الدفع." },
      { property: "og:title", content: "الفواتير | استقبال العيادة الذكية" },
      { property: "og:description", content: "متابعة فواتير المرضى وتحديث الخدمة والسعر وحالة الدفع." },
    ],
  }),
  component: ReceptionInvoices,
});

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient();
  const [service, setService] = useState(invoice.service ?? "");
  const [price, setPrice] = useState(String(invoice.price ?? 0));

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<Invoice>) => {
      const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الفاتورة");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => toast.error("تعذر تحديث الفاتورة"),
  });

  const paid = invoice.payment_status === "paid";

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{invoice.patients?.full_name ?? "—"}</p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            paid ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          {paid ? "مدفوعة" : "غير مدفوعة"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="الخدمة"
          className="h-11 rounded-2xl"
        />
        <Input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="السعر"
          className="h-11 rounded-2xl"
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-10 flex-1 rounded-2xl"
          onClick={() => saveMutation.mutate({ service: service || null, price: Number(price) || 0 })}
        >
          حفظ التعديلات
        </Button>
        {!paid ? (
          <Button
            className="h-10 flex-1 rounded-2xl"
            onClick={() => saveMutation.mutate({ payment_status: "paid" })}
          >
            تحديد كمدفوعة
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="h-10 flex-1 rounded-2xl"
            onClick={() => saveMutation.mutate({ payment_status: "unpaid" })}
          >
            إلغاء الدفع
          </Button>
        )}
      </div>
    </Card>
  );
}

function ReceptionInvoices() {
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", filter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, patients(id, full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("payment_status", filter);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Invoice[];
    },
  });

  return (
    <AppShell title="الفواتير" nav={receptionNav}>
      <div className="mb-4 flex gap-2">
        {(
          [
            ["all", "الكل"],
            ["unpaid", "غير مدفوعة"],
            ["paid", "مدفوعة"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            className="h-10 flex-1 rounded-2xl text-sm"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {invoices.length === 0 ? (
        <EmptyState text="لا توجد فواتير" />
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
