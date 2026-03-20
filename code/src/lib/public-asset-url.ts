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
