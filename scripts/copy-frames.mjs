// Copies the frame pages (frames/) and the sign-in callback page (auth/) into dist/, writes the
// widget's sign-in config, and fills the API and auth origins into each page's
// Content-Security-Policy. These differ per environment, so they can't be hardcoded in the HTML.
import dotenv from "dotenv";
import { cpSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

dotenv.config({ path: process.env.NODE_ENV === "production" ? ".env.production" : ".env" });

const required = ["NANATRI_API_BASE_URL", "NANATRI_AUTH_URL", "NANATRI_SDK_ORIGIN", "NANATRI_DASHBOARD_URL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  // A missing origin would leave the CSP blocking every request, or sign-in pointing nowhere.
  console.error(`[nanatri-sdk] Missing in env: ${missing.join(", ")} — cannot build the frames.`);
  process.exit(1);
}

const apiOrigin    = new URL(process.env.NANATRI_API_BASE_URL).origin;
const authOrigin   = new URL(process.env.NANATRI_AUTH_URL).origin;
const sdkOrigin    = new URL(process.env.NANATRI_SDK_ORIGIN).origin;
const dashboardUrl = process.env.NANATRI_DASHBOARD_URL.replace(/\/+$/, "");

for (const dir of ["frames", "auth"]) {
  rmSync(join("dist", dir), { recursive: true, force: true });
  cpSync(dir, join("dist", dir), { recursive: true });
}

// Served from our own origin, so the shop's page can't change where sign-in or data goes.
writeFileSync(
  "dist/frames/shared/config.js",
  `window.__NANATRI_CONFIG = Object.freeze(${JSON.stringify({
    authUrl:      authOrigin,
    clientId:     "nanatri-widget",
    redirectUri:  `${sdkOrigin}/auth/callback`,
    dashboardUrl: dashboardUrl,
  })});\n`
);

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

for (const file of [...htmlFiles("dist/frames"), ...htmlFiles("dist/auth")]) {
  writeFileSync(
    file,
    readFileSync(file, "utf8")
      .replaceAll("__API_ORIGIN__", apiOrigin)
      .replaceAll("__AUTH_ORIGIN__", authOrigin)
  );
}
