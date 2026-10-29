export const THEME_KEY = "emmtee:theme";

/** Browser UI colour (theme-color meta) per theme; matches --bg in globals.css. */
export const THEME_COLOR = { dark: "#0b1626", light: "#f6f2ea" } as const;

export type ThemeName = keyof typeof THEME_COLOR;

/**
 * Runs in <head> before first paint: applies the stored theme (dark when none) and syncs theme-color.
 * Kept tiny and dependency-free; storage access is wrapped because it throws when blocked.
 */
export const THEME_INIT_SCRIPT = `(function(){var t="dark";try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light")t="light"}catch(e){}document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?${JSON.stringify(THEME_COLOR.light)}:${JSON.stringify(THEME_COLOR.dark)})})()`;
