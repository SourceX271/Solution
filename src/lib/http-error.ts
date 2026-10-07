/**
 * Read the localized `{ error }` message out of a failed API response.
 *
 * Client components used to ignore `!res.ok` entirely, so a rejected write
 * (validation 400, expired session 401, missing target 404) stopped the spinner
 * without telling the user anything. Every non-ok branch should show something;
 * this is the shared way to get the server's (already localized) text.
 */
export async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object") {
      const { error } = data as { error?: unknown };
      if (typeof error === "string" && error.trim()) return error;
    }
  } catch {
    // Non-JSON body (HTML error page, empty response, network hiccup).
  }
  return fallback;
}
