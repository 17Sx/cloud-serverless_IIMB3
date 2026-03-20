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

/**
 * Logo navbar : toujours l’URL absolue sur le bucket/CDN assets (`deploy-assets.py` → clé `assets/...`).
 * Définis `NEXT_PUBLIC_ASSETS_BASE_URL` (ex. https://dxxx.cloudfront.net) pour dev local et CF.
 */
export function headerLogoCdnUrl(filename = "test.png"): string | null {
  const base = cdnBase();
  if (!base) return null;
  const name = filename.replace(/^\/+/, "");
  return `${base}/assets/${name}`;
}
