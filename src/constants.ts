// Boundary line written into imported Docs after the metadata header. The reverse
// converter (to-markup) drops everything up to and including this line, so the
// traceability header never leaks into the published WikiMarkup.
export const CONTENT_MARKER =
  "▼ Article content below — text above is tool metadata; ignore when publishing ▼";

// The contributor-facing cheat sheet for protected tokens (D24). Its URL is published,
// so the Doc is regenerated in place from docs/protected-tokens.wiki, never re-created.
export const CHEAT_SHEET_URL =
  "https://docs.google.com/document/d/1cZLEQwU-4WXeWSSOspTJWD9EgxZAE4hPpJHzCQ9ciOk/edit";
