// Helper to resolve backend image URLs and decode HTML entities
export function decodeHtmlEntities(encoded) {
  if (!encoded || typeof encoded !== "string") return encoded;
  try {
    // Use DOMParser to decode HTML entities (works in browsers)
    const parser = new DOMParser();
    const doc = parser.parseFromString(encoded, "text/html");
    return doc.documentElement.textContent;
  } catch (e) {
    // Fallback simple replacements for common encodings
    return encoded.replace(/&amp;#x2F;/g, "/").replace(/&amp;/g, "&");
  }
}

export function resolveImageSrc(imgPath) {
  if (!imgPath) return null;
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
  // If API_URL includes a trailing /api, strip it for static uploads origin
  const uploadsOrigin = API_URL.replace(/\/api\/?$/, "");
  const decoded = decodeHtmlEntities(imgPath).trim();

  if (!decoded) return null;
  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return decoded;
  }
  // In development, prefer relative paths so Create React App dev server proxies them
  const isDev = process.env.NODE_ENV !== "production";
  if (decoded.startsWith("/")) {
    return isDev ? decoded : `${uploadsOrigin}${decoded}`;
  }
  // plain filename -> serve from /uploads on backend origin (without /api)
  return isDev ? `/uploads/${decoded}` : `${uploadsOrigin}/uploads/${decoded}`;
}
