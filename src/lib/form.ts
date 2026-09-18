// `values` mengembalikan isian form saat validasi gagal: React 19 me-reset form setelah action selesai.
export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | null;
