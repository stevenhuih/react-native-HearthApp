// The logged-in tab bar. Reuses the existing AppTabs navigator (NativeTabs on
// native, custom tab list on web) — nested here so the root gate can redirect
// to/away from it. URLs are unchanged: "/" (index) and "/explore".
export { default } from '@/components/app-tabs';
