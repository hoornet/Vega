/** Dev-only logger — all output is stripped in production builds. */
const isDev = import.meta.env.DEV;

export const debug = {
  log: (...args: unknown[]) => { if (isDev) console.log("[Wrystr]", ...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn("[Wrystr]", ...args); },
  error: (...args: unknown[]) => { if (isDev) console.error("[Wrystr]", ...args); },
};
