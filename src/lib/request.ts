/**
 * Parse a request body as JSON without throwing.
 *
 * `await req.json()` throws a SyntaxError on malformed input, which used to be
 * caught by the route's outer try/catch and returned as a 500. Callers treat
 * `null` as "invalid body" and answer 400 (AGENTS.md §2.4).
 */
export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
