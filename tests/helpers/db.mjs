import { createClient } from "@libsql/client";

/**
 * Akses langsung ke database uji, untuk memeriksa keadaan yang tidak kelihatan di layar
 * (misalnya: foto benar-benar tersimpan berstatus 'pending', bukan sekadar pesan sukses).
 * Default menunjuk ke database uji, bukan ./data milik pengembang.
 */
const url = process.env.TEST_DB_URL ?? "file:testdata/sanapati.db";
const client = createClient({ url });

export async function q(sql, ...args) {
  const r = await client.execute({ sql, args });
  return r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])));
}
export const one = async (sql, ...args) => (await q(sql, ...args))[0];
export const count = async (sql, ...args) => Number(Object.values((await one(sql, ...args)) ?? {})[0] ?? 0);
