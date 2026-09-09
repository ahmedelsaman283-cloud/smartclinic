import type { Appointment, Patient } from "@/lib/clinic";
import { formatDate, formatTime } from "@/lib/clinic";

const NO_DATA = "لا توجد بيانات";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(label: string, value: string | null) {
  const text = value && value.trim() ? escapeHtml(value.trim()).replace(/\n/g, "<br/>") : NO_DATA;
  const muted = value && value.trim() ? "#1f2937" : "#9ca3af";
  return `<div style="margin-top:10px">
      <div style="font-size:12px;font-weight:700;color:#2563eb;margin-bottom:2px">${label}</div>
      <div style="font-size:13px;line-height:1.8;color:${muted}">${text}</div>
    </div>`;
}

export type ReportAttachment = {
  file_name: string;
  file_type: string;
  url: string;
};

function attachmentsSection(attachments: ReportAttachment[]) {
  if (!attachments.length) {
    return `<div style="font-size:13px;color:#9ca3af">لا توجد ملفات مرفقة</div>`;
  }
  return attachments
    .map((a) => {
      const isImage = a.file_type === "image";
      const preview = isImage
        ? `<img src="${escapeHtml(a.url)}" crossorigin="anonymous" style="margin-top:10px;max-width:100%;max-height:420px;border-radius:10px;border:1px solid #e5e7eb"/>`
        : "";
      return `<div style="border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:12px">
          <div style="font-size:14px;font-weight:700;color:#111827">${escapeHtml(a.file_name)}</div>
          <div style="font-size:11px;color:#2563eb;margin-top:4px;word-break:break-all"><a href="${escapeHtml(a.url)}" style="color:#2563eb;text-decoration:underline">${escapeHtml(a.url)}</a></div>
          ${preview}
        </div>`;
    })
    .join("");
}

function buildHtml(
  clinicName: string,
  patient: Patient,
  visits: Appointment[],
  attachments: ReportAttachment[],
) {
  const generatedAt = new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const visitsHtml = visits.length
    ? visits
        .map(
          (
            v,
          ) => `<div style="border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:14px;font-weight:700;color:#111827">${escapeHtml(formatDate(v.appointment_date))}</div>
              <div style="font-size:12px;color:#6b7280">${escapeHtml(formatTime(v.appointment_time))}</div>
            </div>
            ${field("التشخيص", v.diagnosis)}
            ${field("الخطة العلاجية", v.treatment_plan)}
            ${field("ملاحظات إضافية", v.notes)}
          </div>`,
        )
        .join("")
    : `<div style="font-size:13px;color:#9ca3af">لا توجد زيارات مسجلة</div>`;

  return `<div dir="rtl" style="width:794px;padding:40px;box-sizing:border-box;background:#ffffff;font-family:Cairo,'Segoe UI',sans-serif;color:#111827">
      <div style="border-bottom:3px solid #2563eb;padding-bottom:14px;margin-bottom:20px">
        <div style="font-size:24px;font-weight:800;color:#2563eb">${escapeHtml(clinicName)}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px">التقرير الطبي للمريض · ${escapeHtml(generatedAt)}</div>
      </div>

      <div style="background:#f8fafc;border-radius:14px;padding:16px;margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;color:#2563eb;margin-bottom:6px">بيانات المريض</div>
        <div style="font-size:15px;font-weight:700">${escapeHtml(patient.full_name)}</div>
        <div style="font-size:13px;color:#4b5563;margin-top:2px">رقم الهاتف: <span dir="ltr">${escapeHtml(patient.phone ?? NO_DATA)}</span></div>
        <div style="font-size:13px;color:#4b5563;margin-top:2px">تاريخ الميلاد: ${escapeHtml(patient.date_of_birth ? formatDate(patient.date_of_birth) : NO_DATA)}</div>
      </div>

      <div style="font-size:16px;font-weight:800;margin-bottom:12px">سجل الزيارات</div>
      ${visitsHtml}

      <div style="font-size:16px;font-weight:800;margin:24px 0 12px">المرفقات</div>
      ${attachmentsSection(attachments)}
    </div>`;
}

export async function downloadPatientReport(options: {
  clinicName: string;
  patient: Patient;
  visits: Appointment[];
  attachments?: ReportAttachment[];
}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;top:0;left:-10000px;z-index:-1;background:#ffffff";
  host.innerHTML = buildHtml(
    options.clinicName,
    options.patient,
    options.visits,
    options.attachments ?? [],
  );
  document.body.appendChild(host);

  await Promise.all(
    Array.from(host.querySelectorAll("img")).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener(
            "error",
            () => {
              img.remove();
              resolve();
            },
            { once: true },
          );
          setTimeout(resolve, 8000);
        }),
    ),
  );

  try {
    const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pxPerPage = Math.floor((canvas.width * pageHeight) / pageWidth);

    let offset = 0;
    let first = true;
    while (offset < canvas.height) {
      const sliceHeight = Math.min(pxPerPage, canvas.height - offset);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        0,
        pageWidth,
        (sliceHeight * pageWidth) / canvas.width,
      );
      offset += sliceHeight;
    }

    const today = new Date().toISOString().slice(0, 10);
    const safeName = options.patient.full_name
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "-");
    pdf.save(`تقرير-${safeName}-${today}.pdf`);
  } finally {
    host.remove();
  }
}
