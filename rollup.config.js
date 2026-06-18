import "dotenv/config";
import replace    from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs   from "@rollup/plugin-commonjs";
import terser     from "@rollup/plugin-terser";

const apiBaseUrl    = process.env.NANATRI_API_BASE_URL    || "";
const sdkOrigin     = process.env.NANATRI_SDK_ORIGIN     || "https://nanatri-js-sdk.georgemaevsky.workers.dev";
const dashboardUrl  = process.env.NANATRI_DASHBOARD_URL  || "";

if (!apiBaseUrl)   console.warn("[nanatri-sdk] NANATRI_API_BASE_URL is not set in .env — API calls will fail at runtime.");
if (!dashboardUrl) console.warn("[nanatri-sdk] NANATRI_DASHBOARD_URL is not set in .env — post-auth redirect is disabled.");

// ── SDK bundles (TypeScript source) ──────────────────────────────────────
function makeSdkPlugins(minify = false) {
  return [
    replace({
      preventAssignment: true,
      values: {
        __API_BASE_URL__:   JSON.stringify(apiBaseUrl),
        __SDK_ORIGIN__:     JSON.stringify(sdkOrigin),
        __DASHBOARD_URL__:  JSON.stringify(dashboardUrl),
      },
    }),
    nodeResolve(),
    typescript({ tsconfig: "./tsconfig.json", sourceMap: !minify }),
    ...(minify ? [terser()] : []),
  ];
}

// ── Form frame bundle (plain JS + npm deps) ───────────────────────────────
const formPlugins = [
  nodeResolve({ browser: true }),
  commonjs(),
  terser(),
];

/** @type {import('rollup').RollupOptions[]} */
export default [
  // SDK — UMD (script tag / require)
  {
    input: "src/index.ts",
    output: { file: "dist/sdk.js", format: "umd", name: "NanatriSDK", sourcemap: true, exports: "named" },
    plugins: makeSdkPlugins(),
  },
  // SDK — ESM (bundlers)
  {
    input: "src/index.ts",
    output: { file: "dist/sdk.esm.js", format: "esm", sourcemap: true },
    plugins: makeSdkPlugins(),
  },
  // SDK — minified UMD
  {
    input: "src/index.ts",
    output: { file: "dist/sdk.min.js", format: "umd", name: "NanatriSDK", exports: "named", sourcemap: false },
    plugins: makeSdkPlugins(true),
  },
  // Form frame — IIFE loaded in iframe
  {
    input: "frames/form/app.js",
    output: { file: "frames/form/bundle.js", format: "iife", name: "_NanatriForm", sourcemap: false },
    plugins: formPlugins,
  },
];
