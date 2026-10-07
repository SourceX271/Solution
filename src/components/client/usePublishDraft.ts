"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Draft autosave for the publishing forms.
 *
 * Publishing a solution or a question is a long-form task; before this hook a
 * refresh, an accidental navigation or a background tab crash lost everything.
 * The draft lives in `localStorage` (no server round trip, works offline) and
 * is scoped per content type and per account, so two users on one browser never
 * see each other's drafts.
 */

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const DEBOUNCE_MS = 800

interface StoredDraft<T> {
  at: number
  data: T
}

/** A value counts as "empty" only when every field is blank. */
function isEmptyValue(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === "" || value === "<p></p>"
  if (Array.isArray(value)) return value.every(isEmptyValue)
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isEmptyValue)
  return false
}

export interface PublishDraftApi<T> {
  /** A stored draft found on mount, waiting for the user to restore it. */
  pendingDraft: T | null
  /** Timestamp of the last autosave, for the "saved at ..." hint. */
  savedAt: number | null
  /** Apply the pending draft and resume autosaving. */
  restore: () => T | null
  /** Throw the pending draft away. */
  discard: () => void
  /** Call after a successful publish so nothing is restored next time. */
  clear: () => void
}

export function usePublishDraft<T extends object>(
  storageKey: string,
  value: T,
  options: { enabled?: boolean } = {}
): PublishDraftApi<T> {
  const { enabled = true } = options
  const [pendingDraft, setPendingDraft] = useState<T | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Autosave pauses while a stored draft is waiting: otherwise the empty initial
  // form would immediately overwrite the draft the user has not answered about.
  const waitingRef = useRef(false)
  const firstRunRef = useRef(true)
  // Set once the content has been published, so nothing is restored later.
  const completedRef = useRef(false)
  const serialized = JSON.stringify(value)

  useEffect(() => {
    if (!enabled) return
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as StoredDraft<T>
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.at !== "number" ||
        Date.now() - parsed.at > MAX_AGE_MS
      ) {
        window.localStorage.removeItem(storageKey)
        return
      }
      setSavedAt(parsed.at)
      if (parsed.data && !isEmptyValue(parsed.data)) {
        waitingRef.current = true
        setPendingDraft(parsed.data)
      }
    } catch {
      // Private mode / corrupt JSON must never break the form.
    }
  }, [storageKey, enabled])

  useEffect(() => {
    if (!enabled || waitingRef.current || completedRef.current) return
    if (firstRunRef.current) {
      firstRunRef.current = false
      return
    }
    let parsed: T
    try {
      parsed = JSON.parse(serialized) as T
    } catch {
      return
    }
    if (isEmptyValue(parsed)) return

    const handle = window.setTimeout(() => {
      try {
        const at = Date.now()
        window.localStorage.setItem(storageKey, JSON.stringify({ at, data: parsed }))
        setSavedAt(at)
      } catch {
        // Quota exceeded / storage disabled: keep editing without drafts.
      }
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [serialized, storageKey, enabled])

  // Deliberately no `beforeunload` guard: the content is already in
  // localStorage, so a reload — or a closed tab — costs at most the debounce
  // window, and the restore banner brings the text back. A "leave site?" dialog
  // on top of that is pure friction.

  const restore = useCallback(() => {
    const draft = pendingDraft
    waitingRef.current = false
    setPendingDraft(null)
    return draft
  }, [pendingDraft])

  const discard = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    waitingRef.current = false
    setPendingDraft(null)
    setSavedAt(null)
  }, [storageKey])

  const clear = useCallback(() => {
    completedRef.current = true
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    setPendingDraft(null)
    setSavedAt(null)
  }, [storageKey])

  return { pendingDraft, savedAt, restore, discard, clear }
}
