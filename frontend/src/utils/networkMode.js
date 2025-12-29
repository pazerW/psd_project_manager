import { reactive } from "vue";

const STORAGE_KEY = "networkMode";
const DEFAULT = "internal"; // 'internal' or 'external'

const externalBase =
  import.meta.env.VITE_EXTERNAL_DOWNLOAD_BASE ||
  window.__EXTERNAL_DOWNLOAD_BASE__ ||
  "";

const internalOrigins = (import.meta.env.VITE_INTERNAL_ORIGINS || window.__INTERNAL_ORIGINS__ || "")
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const state = reactive({
  mode: localStorage.getItem(STORAGE_KEY) || DEFAULT,
  externalBase,
});

function setMode(m) {
  state.mode = m;
  try {
    localStorage.setItem(STORAGE_KEY, m);
  } catch (e) {
    // ignore
  }
}

function isInternal() {
  return state.mode === "internal";
}

function getDownloadUrl(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return relativeOrAbsolute;

  // Try to parse input as URL (may be absolute or relative)
  let u;
  try {
    u = new URL(relativeOrAbsolute, window.location.href);
  } catch (e) {
    // treat as plain relative path string
    if (isInternal()) return relativeOrAbsolute;
    if (state.externalBase) {
      const base = state.externalBase.replace(/\/$/, "");
      return relativeOrAbsolute.startsWith("/") ? base + relativeOrAbsolute : base + "/" + relativeOrAbsolute;
    }
    return relativeOrAbsolute;
  }

  // If internal mode, return original input
  if (isInternal()) return relativeOrAbsolute;

  // External mode: if no external base configured, return original
  if (!state.externalBase) return relativeOrAbsolute;

  // Determine if the parsed URL is an internal origin we should map
  function isPrivateIp(hostname) {
    // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!ipMatch) return false;
    const a = parseInt(ipMatch[1], 10);
    const b = parseInt(ipMatch[2], 10);
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  function isInternalOrigin(origin) {
    try {
      const o = new URL(origin);
      const host = o.hostname;
      if (internalOrigins.includes(o.origin) || internalOrigins.includes(host)) return true;
      if (host === 'localhost') return true;
      if (isPrivateIp(host)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  // If URL already points to a non-internal origin, return as-is
  try {
    if (!isInternalOrigin(u.origin)) return relativeOrAbsolute;
  } catch (e) {
    // fallthrough
  }

  // Build external URL by replacing origin with external base origin (preserve path/query/hash)
  try {
    const eb = new URL(state.externalBase, window.location.href);
    return eb.origin + u.pathname + u.search + u.hash;
  } catch (err) {
    // externalBase might be a path-only string; fallback to simple prefix
    const base = state.externalBase.replace(/\/$/, "");
    return base + (u.pathname + u.search + u.hash);
  }
}

export default {
  state,
  setMode,
  isInternal,
  getDownloadUrl,
};
