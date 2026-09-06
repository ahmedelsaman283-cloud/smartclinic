import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { receptionNav } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatMoney, type Invoice } from "@/lib/clinic";

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
  const [price, setPrice] = useState(invoice.price == null ? "" : String(invoice.price));
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (patch: {
      service?: string | null;
      price?: number;
      payment_status?: "paid" | "unpaid";
    }) => {
      const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الفاتورة");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: () => toast.error("تعذر تحديث الفاتورة"),
  });

  const paid = invoice.payment_status === "paid";

  function validate() {
    if (!service.trim()) {
      setError("يجب إدخال اسم الخدمة");
      toast.error("يجب إدخال اسم الخدمة");
      return false;
    }
    if (price.trim() === "" || Number.isNaN(Number(price)) || Number(price) <= 0) {
      setError("يجب إدخال سعر صحيح أكبر من صفر");
      toast.error("يجب إدخال سعر صحيح أكبر من صفر");
      return false;
    }
    setError(null);
    return true;
  }

  function handleSave() {
    if (!validate()) return;
    saveMutation.mutate({ service: service.trim(), price: Number(price) });
  }

  function handleMarkPaid() {
    if (!validate()) return;
    saveMutation.mutate({ service: service.trim(), price: Number(price), payment_status: "paid" });
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{invoice.patients?.full_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(invoice.created_at)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            paid ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          {paid ? "مدفوعة" : "غير مدفوعة"}
        </span>
      </div>

      <p className="text-sm font-semibold text-primary">{formatMoney(invoice.price)}</p>

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
          placeholder="السعر (جنيه)"
          className="h-11 rounded-2xl"
        />
      </div>

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button variant="outline" className="h-10 flex-1 rounded-2xl" onClick={handleSave}>
          حفظ التعديلات
        </Button>
        {!paid ? (
          <Button className="h-10 flex-1 rounded-2xl" onClick={handleMarkPaid}>
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
