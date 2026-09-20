/// <reference types="vite/client" />

/**
 * This build's Corresponding Source, from `package.json`'s `repository` (`UI-38`).
 *
 * Defined by Vite rather than imported, so a fork changes one manifest field and its own instance
 * offers its own source. `vitest.config.ts` merges the build config, so it holds in tests too.
 */
declare const __SOURCE_URL__: string;
