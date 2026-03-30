/** Dev-only logger — all output is stripped in production builds. */
const isDev = import.meta.env.DEV;

export const debug = {
  log: (...args: unknown[]) => { if (isDev) console.log("[Vega]", ...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn("[Vega]", ...args); },
  error: (...args: unknown[]) => { if (isDev) console.error("[Vega]", ...args); },
};
