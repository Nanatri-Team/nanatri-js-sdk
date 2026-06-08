import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

const input = "src/index.ts";

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input,
    output: {
      file: "dist/sdk.js",
      format: "umd",
      name: "NanatriSDK",
      sourcemap: true,
      exports: "named",
    },
    plugins: [nodeResolve(), typescript({ tsconfig: "./tsconfig.json" })],
  },
  {
    input,
    output: {
      file: "dist/sdk.esm.js",
      format: "esm",
      sourcemap: true,
    },
    plugins: [nodeResolve(), typescript({ tsconfig: "./tsconfig.json" })],
  },
  {
    input,
    output: {
      file: "dist/sdk.min.js",
      format: "umd",
      name: "NanatriSDK",
      exports: "named",
      sourcemap: false,
    },
    plugins: [nodeResolve(), typescript({ tsconfig: "./tsconfig.json", sourceMap: false }), terser()],
  },
];
