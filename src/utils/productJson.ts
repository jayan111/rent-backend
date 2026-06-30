const BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 8000}`;

/** Safely parse images from DB (JSON column may be string, array, or single path). */
export function parseImages(raw: string | string[] | null | undefined): string[] {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map((img: unknown) => String(img)).filter(Boolean);
  }
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [String(parsed)];
    } catch {
      return s.includes(',') ? s.split(',').map((x) => x.trim()).filter(Boolean) : [s];
    }
  }
  if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter(Boolean);
  return [s];
}

/** Safely parse subscription_durations from DB (JSON column may be string, array, or "3,6,12"). */
export function parseSubscriptionDurations(raw: string | number[] | null | undefined): number[] {
  const defaultDurations = [3, 6, 12];
  if (raw == null || raw === '') return defaultDurations;
  if (Array.isArray(raw)) {
    const nums = raw.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
    return nums.length ? nums : defaultDurations;
  }
  const s = String(raw).trim();
  if (!s) return defaultDurations;
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        const nums = parsed.map((x: unknown) => Number(x)).filter((n: number) => !Number.isNaN(n));
        return nums.length ? nums : defaultDurations;
      }
    } catch {
      // fall through to comma split
    }
  }
  if (s.includes(',')) {
    const nums = s.split(',').map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n));
    return nums.length ? nums : defaultDurations;
  }
  const n = Number(s);
  return !Number.isNaN(n) ? [n] : defaultDurations;
}

/** Normalize image URLs (add base URL if relative path). */
export function normalizeImageUrls(images: string[]): string[] {
  return images.map((img) =>
    img.startsWith('http') ? img : (img.startsWith('/') ? `${BASE_URL}${img}` : `${BASE_URL}/${img}`)
  );
}
