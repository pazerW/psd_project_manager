import { reactive } from "vue";

const STORAGE_KEY = "networkMode";
const DEFAULT = "internal"; // 'internal' or 'external'

const externalBase = import.meta.env.VITE_EXTERNAL_DOWNLOAD_BASE || "";

const internalOrigins = (import.meta.env.VITE_INTERNAL_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const state = reactive({
  mode: localStorage.getItem(STORAGE_KEY) || DEFAULT,
  externalBase,
});

// Normalize a chosen internal origin (prefer entry without port, fallback to first)
function getNormalizedInternalOrigin() {
  if (!internalOrigins || internalOrigins.length === 0) return null;
  // Prefer entry that includes a port (internal must have port per requirement)
  let candidate =
    internalOrigins.find((s) => {
      try {
        return !!new URL(s).port;
      } catch (e) {
        return s.indexOf(":") !== -1; // string contains ':' considered as host:port
      }
    }) || internalOrigins[0];

  try {
    let u = new URL(candidate);
    return u.origin;
  } catch (e) {
    // add protocol if missing
    const withProto = candidate.startsWith("http")
      ? candidate
      : `http://${candidate}`;
    try {
      const u = new URL(withProto);
      return u.origin;
    } catch (err) {
      return null;
    }
  }
}

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
  // Normalize absolute URLs to relative path (strip origin). Then always prefix based on mode.
  let relativePath = relativeOrAbsolute;
  try {
    const u = new URL(relativeOrAbsolute, window.location.href);
    relativePath = (u.pathname || "") + (u.search || "") + (u.hash || "");
  } catch (e) {
    // keep original string as relativePath
  }

  const internalOrigin = getNormalizedInternalOrigin();
  if (isInternal()) {
    if (internalOrigin)
      return relativePath.startsWith("/")
        ? internalOrigin + relativePath
        : internalOrigin + "/" + relativePath;
    return relativePath;
  }

  if (state.externalBase) {
    const base = state.externalBase.replace(/\/$/, "");
    return relativePath.startsWith("/")
      ? base + relativePath
      : base + "/" + relativePath;
  }

  return relativePath;
}

export default {
  state,
  setMode,
  isInternal,
  getDownloadUrl,
};
