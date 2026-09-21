"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form";
import { useI18n } from "./I18nProvider";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingText ?? t.common.processing) : children}
    </button>
  );
}

const FILE_CLASS =
  "input py-2 file:mr-3 file:rounded-full file:border-0 file:bg-court-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-court-800";

/**
 * Input file yang memeriksa ukuran begitu foto dipilih, bukan menunggu server menolaknya.
 *
 * Bukan sekadar kenyamanan: Vercel memutus request yang badannya lewat 4,5 MB sebelum server
 * action sempat jalan, jadi unggahan kebesaran gagal tanpa pesan apa pun — layar hanya diam.
 * File yang lewat batas dikeluarkan dari pilihan supaya formulir tidak bisa terkirim membawanya;
 * file lain yang ikut terpilih tetap dipertahankan agar satu foto besar tidak membatalkan sisanya.
 *
 * Pemeriksaan di server (lib/uploads.ts) tetap ada dan tetap yang menentukan: ini lapis pertama,
 * bukan pengganti.
 */
export function FileField({
  maxBytes,
  onPick,
  label,
  labelClassName,
  className = FILE_CLASS,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "onChange"> & {
  maxBytes: number;
  /** Dipanggil setelah pilihan yang lolos pemeriksaan — dipakai avatar yang langsung submit. */
  onPick?: () => void;
  /** Untuk input yang disembunyikan di balik tombol: isi <label> pembungkusnya. */
  label?: React.ReactNode;
  labelClassName?: string;
}) {
  const { t, f } = useI18n();
  const [warning, setWarning] = useState<string | null>(null);

  const check = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const picked = [...(input.files ?? [])];
    if (picked.length === 0) {
      setWarning(null);
      return;
    }

    const messages: string[] = [];
    const kept = picked.filter((file) => {
      if (file.size <= maxBytes) return true;
      messages.push(t.upload.tooBig(file.name, f.fileSize(file.size), f.fileSize(maxBytes)));
      return false;
    });

    if (kept.length < picked.length) {
      const sisa = new DataTransfer();
      for (const file of kept) sisa.items.add(file);
      input.files = sisa.files;
    }
    setWarning(messages.join(" ") || null);
    if (kept.length > 0) onPick?.();
  };

  const field = (
    <input accept="image/jpeg,image/png,image/webp" {...props} type="file" className={className} onChange={check} />
  );
  return (
    <>
      {label ? <label className={labelClassName}>{label}{field}</label> : field}
      {/* basis-full: kalau induknya baris flex (tombol avatar), peringatan turun ke barisnya sendiri. */}
      {warning && (
        <p role="alert" className="mt-1.5 basis-full rounded-xl bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">
          {warning}
        </p>
      )}
    </>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`rounded-xl px-3.5 py-2.5 text-sm ${
        state.error ? "bg-clay-50 text-clay-700" : "bg-court-50 text-court-800"
      }`}
    >
      {state.error ?? state.ok}
    </p>
  );
}
