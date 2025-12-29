import { reactive } from 'vue'

const STORAGE_KEY = 'networkMode'
const DEFAULT = 'internal' // 'internal' or 'external'

const externalBase = import.meta.env.VITE_EXTERNAL_DOWNLOAD_BASE || window.__EXTERNAL_DOWNLOAD_BASE__ || ''

const state = reactive({
  mode: localStorage.getItem(STORAGE_KEY) || DEFAULT,
  externalBase
})

function setMode(m) {
  state.mode = m
  try {
    localStorage.setItem(STORAGE_KEY, m)
  } catch (e) {
    // ignore
  }
}

function isInternal() {
  return state.mode === 'internal'
}

function getDownloadUrl(relativeOrAbsolute) {
  // If already absolute URL, return as-is
  if (!relativeOrAbsolute) return relativeOrAbsolute
  try {
    const u = new URL(relativeOrAbsolute, window.location.href)
    // if input had a protocol or host, URL will include it
    if (u.origin && u.origin !== window.location.origin) {
      return relativeOrAbsolute
    }
  } catch (e) {
    // not an absolute URL
  }

  if (isInternal()) return relativeOrAbsolute

  // external mode: prefix with configured external base if available
  if (state.externalBase) {
    // ensure no double slash
    return state.externalBase.replace(/\/$/, '') + relativeOrAbsolute
  }

  // fallback to provided relative
  return relativeOrAbsolute
}

export default {
  state,
  setMode,
  isInternal,
  getDownloadUrl,
}
