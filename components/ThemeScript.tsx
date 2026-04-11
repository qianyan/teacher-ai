import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Runs before paint to align `data-theme` with localStorage (avoids flash). */
export function ThemeScript() {
  const js = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);else document.documentElement.setAttribute('data-theme','light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: js }}
      suppressHydrationWarning
    />
  );
}
