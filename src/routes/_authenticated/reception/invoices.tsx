import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarIcon, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, EmptyState } from "@/components/app-shell";
import { receptionNav } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDateTime, formatMoney, invoiceTotal, todayISO, type Invoice } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/reception/invoices")({
  head: () => ({
    meta: [
      { title: "الفواتير | استقبال العيادة الذكية" },
      { name: "description", content: "متابعة فواتير المرضى مع خدمات متعددة لكل فاتورة وحالة الدفع." },
      { property: "og:title", content: "الفواتير | استقبال العيادة الذكية" },
      { property: "og:description", content: "متابعة فواتير المرضى مع خدمات متعددة لكل فاتورة وحالة الدفع." },
    ],
  }),
  component: ReceptionInvoices,
});

type LineDraft = { id: string | null; service: string; price: string };

type DateFilterKey = "today" | "week" | "month" | "all" | "custom";

const DATE_FILTER_LABELS: Record<DateFilterKey, string> = {
  today: "اليوم",
  week: "هذا الأسبوع",
  month: "هذا الشهر",
  all: "الكل",
  custom: "نطاق مخصص",
};

function toDrafts(invoice: Invoice): LineDraft[] {
  const items = invoice.invoice_items ?? [];
  if (items.length === 0) return [{ id: null, service: "", price: "" }];
  return items.map((item) => ({ id: item.id, service: item.service ?? "", price: String(item.price ?? "") }));
}

function rangeForFilter(filter: DateFilterKey, customFrom?: Date, customTo?: Date) {
  if (filter === "all") return null;
  if (filter === "custom") {
    if (!customFrom || !customTo) return null;
    return { from: format(customFrom, "yyyy-MM-dd"), to: format(customTo, "yyyy-MM-dd") };
  }
  const today = new Date(`${todayISO()}T00:00:00`);
  let from = todayISO();
  if (filter === "week") {
    const day = today.getDay(); // 0 = Sunday
    const diff = (day + 1) % 7; // week starts Saturday
    today.setDate(today.getDate() - diff);
    from = format(today, "yyyy-MM-dd");
  } else if (filter === "month") {
    today.setDate(1);
    from = format(today, "yyyy-MM-dd");
  }
  return { from, to: todayISO() };
}

function DatePicker({
  value,
  onChange,
  placeholder,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-start rounded-2xl text-right font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="ms-2 h-4 w-4" />
          {value ? format(value, "yyyy-MM-dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<LineDraft[]>(() => toDrafts(invoice));
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);
  const paid = invoice.payment_status === "paid";

  const saveMutation = useMutation({
    mutationFn: async (opts: { markPaid?: boolean } = {}) => {
      const keepIds = lines.map((l) => l.id).filter(Boolean) as string[];
      const removed = (invoice.invoice_items ?? []).filter((item) => !keepIds.includes(item.id));
      if (removed.length > 0) {
        const { error } = await supabase
          .from("invoice_items")
          .delete()
          .in("id", removed.map((item) => item.id));
        if (error) throw error;
      }
      for (const line of lines) {
        const payload = { service: line.service.trim(), price: Number(line.price) };
        if (line.id) {
          const { error } = await supabase.from("invoice_items").update(payload).eq("id", line.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("invoice_items").insert({ ...payload, invoice_id: invoice.id });
          if (error) throw error;
        }
      }
      if (opts.markPaid) {
        const { error } = await supabase
          .from("invoices")
          .update({ payment_status: "paid" })
          .eq("id", invoice.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم تحديث الفاتورة");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: () => toast.error("تعذر تحديث الفاتورة"),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: "paid" | "unpaid") => {
      const { error } = await supabase.from("invoices").update({ payment_status: status }).eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: () => toast.error("تعذر تحديث الفاتورة"),
  });

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { id: null, service: "", price: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function validate() {
    if (lines.length === 0) {
      setError("يجب إضافة خدمة واحدة على الأقل");
      toast.error("يجب إضافة خدمة واحدة على الأقل");
      return false;
    }
    for (const line of lines) {
      if (!line.service.trim()) {
        setError("يجب إدخال اسم الخدمة لكل بند");
        toast.error("يجب إدخال اسم الخدمة لكل بند");
        return false;
      }
      if (line.price.trim() === "" || Number.isNaN(Number(line.price)) || Number(line.price) <= 0) {
        setError("يجب إدخال سعر صحيح أكبر من صفر لكل بند");
        toast.error("يجب إدخال سعر صحيح أكبر من صفر لكل بند");
        return false;
      }
    }
    setError(null);
    return true;
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

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={line.id ?? `new-${index}`} className="flex gap-2">
            <Input
              value={line.service}
              onChange={(e) => updateLine(index, { service: e.target.value })}
              placeholder="الخدمة"
              className="h-11 flex-1 rounded-2xl"
            />
            <Input
              type="number"
              value={line.price}
              onChange={(e) => updateLine(index, { price: e.target.value })}
              placeholder="السعر (جنيه)"
              className="h-11 w-28 rounded-2xl"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="حذف الخدمة"
              className="h-11 w-11 shrink-0 rounded-2xl text-destructive"
              onClick={() => removeLine(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" className="h-10 w-full rounded-2xl text-sm" onClick={addLine}>
        <Plus className="ms-1 h-4 w-4" />
        إضافة خدمة
      </Button>

      <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
        <span className="text-sm text-muted-foreground">الإجمالي</span>
        <span className="text-base font-bold text-primary">{formatMoney(total)}</span>
      </div>

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-10 flex-1 rounded-2xl"
          disabled={saveMutation.isPending}
          onClick={() => validate() && saveMutation.mutate({})}
        >
          حفظ التعديلات
        </Button>
        {!paid ? (
          <Button
            className="h-10 flex-1 rounded-2xl"
            disabled={saveMutation.isPending}
            onClick={() => validate() && saveMutation.mutate({ markPaid: true })}
          >
            تحديد كمدفوعة
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="h-10 flex-1 rounded-2xl"
            onClick={() => statusMutation.mutate("unpaid")}
          >
            إلغاء الدفع
          </Button>
        )}
      </div>
    </Card>
  );
}

function ReceptionInvoices() {
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("today");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [searchQuery, setSearchQuery] = useState("");

  const dateRange = rangeForFilter(dateFilter, customFrom, customTo);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", statusFilter, dateFilter, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, patients(id, full_name), invoice_items(id, invoice_id, service, price)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") query = query.eq("payment_status", statusFilter);
      if (dateRange) {
        query = query.gte("created_at", `${dateRange.from}T00:00:00`).lte("created_at", `${dateRange.to}T23:59:59.999`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Invoice[];
    },
  });

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredInvoices = invoices.filter((invoice) => {
    if (!normalizedSearch) return true;
    const patientName = invoice.patients?.full_name ?? "";
    return patientName.toLowerCase().includes(normalizedSearch);
  });

  const totalShown = filteredInvoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);

  return (
    <AppShell title="الفواتير" nav={receptionNav}>
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث باسم المريض..."
            className="h-11 rounded-2xl pe-4 ps-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(DATE_FILTER_LABELS) as DateFilterKey[]).map((key) => (
            <Button
              key={key}
              variant={dateFilter === key ? "default" : "outline"}
              className="h-10 flex-1 rounded-2xl text-sm"
              onClick={() => setDateFilter(key)}
            >
              {DATE_FILTER_LABELS[key]}
            </Button>
          ))}
        </div>

        {dateFilter === "custom" ? (
          <div className="grid grid-cols-2 gap-2">
            <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="من" />
            <DatePicker value={customTo} onChange={setCustomTo} placeholder="إلى" />
          </div>
        ) : null}

        <div className="flex gap-2">
          {(
            [
              ["all", "الكل"],
              ["unpaid", "غير مدفوعة"],
              ["paid", "مدفوعة"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              className="h-10 flex-1 rounded-2xl text-sm"
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <EmptyState text="لا توجد فواتير" />
      ) : (
        <>
          <Card className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">إجمالي الفواتير المعروضة</span>
            <span className="text-base font-bold text-primary">{formatMoney(totalShown)}</span>
          </Card>
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
