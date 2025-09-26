export function buildLooseCodeRegex(q) {
  if (!q) return null;
  const raw = String(q)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!raw) return null;
  const parts = raw.match(/[a-z]+|\d+/g) || [];
  const pattern = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^a-z0-9]*");
  return new RegExp(pattern, "i");
}
