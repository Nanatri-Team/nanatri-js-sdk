// All constants injected at build time by the rollup replace plugin.
// Edit .env to change them — never hardcode values here.
declare const __SDK_ORIGIN__:    string;
declare const __API_BASE_URL__:  string;
declare const __DASHBOARD_URL__: string;

export const SDK_ORIGIN:    string = __SDK_ORIGIN__;
export const API_BASE_URL:  string = __API_BASE_URL__;
export const DASHBOARD_URL: string = __DASHBOARD_URL__;
