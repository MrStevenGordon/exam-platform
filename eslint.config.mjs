import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored build output and the standalone marketing scripts are not part of the app.
    "public/pdf.worker.min.mjs",
    // The offline service worker is plain browser script, tested in scripts/tests/offline/sw.test.mjs.
    "public/sw.js",
    "marketing/**",
    // The glitch checker is its own small project (see e2e/README.md).
    "e2e/**",
  ]),
]);

export default eslintConfig;
