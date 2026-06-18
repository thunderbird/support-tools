// Boundary line written into imported Docs after the metadata header. The reverse
// converter (to-markup) drops everything up to and including this line, so the
// traceability header never leaks into the published WikiMarkup.
export const CONTENT_MARKER =
  "▼ Article content below — text above is tool metadata; ignore when publishing ▼";
