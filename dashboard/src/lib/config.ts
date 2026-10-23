/** API base. Empty means same-origin (demo mode: Express serves `out/`). Next inlines this literal at build time. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
