/**
 * Notification bodies are stored as a small JSON payload
 * (`{"key":"newAnswer","params":{"name":"…","title":"…"}}`) rather than a
 * rendered sentence, so the reader sees the message in their own language.
 *
 * Rows written before this change stored plain text; those are returned as-is
 * so old notifications keep rendering.
 */
export interface NotificationMessagePayload {
  key: string;
  params?: Record<string, string>;
}

export function serializeNotificationMessage(
  key: string,
  params?: Record<string, string>
): string {
  return JSON.stringify({ key, params: params ?? {} });
}

export function parseNotificationMessage(raw: string | null | undefined): NotificationMessagePayload | null {
  if (!raw || !raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.key === "string") {
      return {
        key: parsed.key,
        params: parsed.params && typeof parsed.params === "object" ? parsed.params : {},
      };
    }
  } catch {
    // Not a structured payload — fall through to the raw string.
  }
  return null;
}

/**
 * Render a stored notification for display.
 *
 * `t` must be scoped to the `notifications` namespace. Unknown keys and
 * malformed payloads fall back to the stored text instead of throwing.
 */
export function renderNotificationMessage(
  raw: string | null | undefined,
  t: (key: string, values?: Record<string, string>) => string
): string {
  if (!raw) return "";
  const payload = parseNotificationMessage(raw);
  if (!payload) return raw;
  try {
    return t(payload.key, payload.params ?? {});
  } catch {
    return raw;
  }
}
