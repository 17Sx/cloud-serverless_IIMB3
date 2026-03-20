/**
 * Fichiers servis depuis S3/CloudFront (préfixe `assets/` via deploy-assets.py).
 * En local sans CDN : même chemin sous `public/assets/` (sync depuis la racine `assets/`).
 */
export function publicAssetUrl(pathFromAssetsRoot: string): string {
  const trimmed = pathFromAssetsRoot.replace(/^\/+/, "");
  const path = `/assets/${trimmed}`;
  const base = (process.env.NEXT_PUBLIC_ASSETS_BASE_URL ?? "").replace(/\/$/, "");
  if (base) return `${base}${path}`;
  return path;
}

const cdnBase = () => (process.env.NEXT_PUBLIC_ASSETS_BASE_URL ?? "").trim().replace(/\/$/, "");

/** URL du logo sans paramètre de cache (S3 : `assets/<fichier>`). */
export function headerLogoCdnBaseUrl(filename = "test.png"): string | null {
  const base = cdnBase();
  if (!base) return null;
  const name = filename.replace(/^\/+/, "");
  return `${base}/assets/${name}`;
}

/**
 * Logo navbar : URL absolue + option `?v=` si `NEXT_PUBLIC_ASSETS_CACHE_KEY` (rebuild front après changement d’image, même nom de fichier).
 */
export function headerLogoCdnUrl(filename = "test.png"): string | null {
  const u = headerLogoCdnBaseUrl(filename);
  if (!u) return null;
  const bust = (process.env.NEXT_PUBLIC_ASSETS_CACHE_KEY ?? "").trim();
  if (bust) {
    return `${u}?v=${encodeURIComponent(bust)}`;
  }
  return u;
}

/** En dev (ou si LOGO_NO_BROWSER_CACHE=1), forcer un ?cb= côté client pour contourner le cache disque du navigateur. */
export function shouldBustBrowserLogoCache(): boolean {
  const env = (process.env.NEXT_PUBLIC_ENV ?? "").toLowerCase();
  if (env === "dev" || env === "development") return true;
  return process.env.NEXT_PUBLIC_ASSETS_LOGO_NO_BROWSER_CACHE === "1";
}
