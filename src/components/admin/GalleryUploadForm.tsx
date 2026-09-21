"use client";

import { useState } from "react";
import { addGalleryPhoto, refreshGallery } from "@/app/actions/admin";
import type { FormState } from "@/lib/form";
import { opt } from "@/lib/i18n";
import { GALLERY_CATEGORIES } from "@/lib/options";
import { MAX_FILES_PER_UPLOAD, MAX_GALLERY_BYTES } from "@/lib/upload-limits";
import { useI18n } from "../I18nProvider";
import { FileField, FormMessage } from "../ui";

/**
 * Mengunggah satu foto per request, berurutan — bukan semua foto dalam satu kiriman gemuk.
 * Alasan lengkapnya ada di catatan addGalleryPhoto: batas ukuran request berlaku per request,
 * jadi cara ini menghapus batas jumlah foto sekali unggah, dan foto yang sudah masuk tetap
 * tersimpan walau sisanya gagal di tengah jalan.
 *
 * Karena itu formulir ini tidak memakai `action={...}` bawaan React: pengirimannya diatur sendiri
 * supaya bisa berulang, menampilkan kemajuan, dan melaporkan foto mana saja yang gagal.
 */
export function GalleryUploadForm() {
  const { t, f } = useI18n();
  const g = t.admin.gallery;
  const [state, setState] = useState<FormState>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Dinaikkan setelah tiap rangkaian untuk memasang ulang FileField, supaya pilihan file dan
  // peringatan ukurannya ikut bersih — form.reset() tidak menyentuh state di dalam komponen.
  const [round, setRound] = useState(0);

  async function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const isian = new FormData(form);
    const files = isian.getAll("file").filter((x): x is File => x instanceof File && x.size > 0);
    if (files.length === 0) return setState({ error: t.errors.chooseFile });
    if (files.length > MAX_FILES_PER_UPLOAD) return setState({ error: t.errors.tooManyFiles });

    setState(null);
    setProgress({ done: 0, total: files.length });
    let added = 0;
    const failures: string[] = [];

    for (const [i, file] of files.entries()) {
      const satu = new FormData();
      satu.set("file", file);
      satu.set("title", String(isian.get("title") ?? ""));
      satu.set("category", String(isian.get("category") ?? ""));
      // Nomor urut ikut dikirim karena server cuma melihat satu foto per request; dipakai untuk judul.
      satu.set("index", String(i));
      satu.set("total", String(files.length));
      try {
        const hasil = await addGalleryPhoto(satu);
        if (hasil?.error) failures.push(`${file.name} — ${hasil.error}`);
        else added++;
      } catch {
        // Jaringan putus di tengah rangkaian tidak boleh menghentikan sisa fotonya.
        failures.push(`${file.name} — ${t.upload.sendFailed}`);
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setProgress(null);
    // Sekali di akhir, juga kalau sebagian gagal: yang sudah masuk harus langsung terlihat.
    if (added > 0) await refreshGallery();

    const ok = added === 1 ? t.ok.photoAdded : t.ok.photosAdded(added);
    if (added === 0) setState({ error: t.upload.failedList(failures) });
    else setState(failures.length ? { ok: `${ok} ${t.upload.failedList(failures)}` } : { ok });
    form.reset();
    setRound((n) => n + 1);
  }

  return (
    <form onSubmit={kirim} className="grid gap-3 sm:grid-cols-[1.2fr_auto_1.2fr_auto] sm:items-end">
      <div>
        <label htmlFor="g-title" className="label">{g.titleOptional}</label>
        <input id="g-title" name="title" maxLength={80} className="input" />
      </div>
      <div>
        <label htmlFor="g-category" className="label">{g.category}</label>
        <select id="g-category" name="category" className="input">
          {GALLERY_CATEGORIES.map((c) => <option key={c} value={c}>{opt(t, c)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="g-file" className="label">{g.fileMulti(f.fileSize(MAX_GALLERY_BYTES), MAX_FILES_PER_UPLOAD)}</label>
        {/* multiple: satu hari pertandingan bisa puluhan foto — tanpa ini admin harus submit satu per satu. */}
        <FileField key={round} id="g-file" name="file" multiple required maxBytes={MAX_GALLERY_BYTES} />
      </div>
      <button type="submit" disabled={!!progress} className="btn btn-primary">
        {progress ? g.uploadingN(progress.done, progress.total) : g.upload}
      </button>
      <p className="text-xs text-muted sm:col-span-4">{g.titleHint}</p>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
