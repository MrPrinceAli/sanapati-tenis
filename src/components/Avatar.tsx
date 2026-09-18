// `avatar` = nama file foto profil hasil upload (kosong = pakai inisial berwarna).
export function Avatar({ name, hue, size = 40, avatar }: { name: string; hue: number; size?: number; avatar?: string }) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/media/${avatar}`}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-sand object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue} 55% 88%)`,
        color: `hsl(${hue} 60% 24%)`,
      }}
    >
      {initials}
    </span>
  );
}

// `label` = teks terjemahan; `level` tetap nilai asli dari database untuk menentukan warna.
export function LevelBadge({ level, label }: { level: string; label?: string }) {
  const tone =
    level === "Mahir"
      ? "bg-court-900 text-ball"
      : level === "Menengah"
        ? "bg-court-100 text-court-800"
        : "bg-sand text-ink";
  return <span className={`badge ${tone}`}>{label ?? level}</span>;
}
