/** Deep walk: any object carrying an `id` present in the map gets the
 * fresh id — covers entity field refs, link endpoints, canvas cards.
 * Shared by project import and generation-bundle apply. */
export function remapRefs<T>(value: T, idMap: Map<string, string>): T {
  if (Array.isArray(value)) return value.map((v) => remapRefs(v, idMap)) as T;
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = remapRefs(v, idMap);
    }
    if (typeof out.id === 'string' && idMap.has(out.id)) out.id = idMap.get(out.id);
    return out as T;
  }
  return value;
}
