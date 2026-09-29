// Design-sync shim: outside Next.js, the current path is the browser's.
// `data-pathname` on <html> lets a design pin the active tab explicitly.
export function usePathname(): string {
  if (typeof document === 'undefined') return '/';
  return document.documentElement.dataset.pathname ?? '/';
}

export function useRouter() {
  return { push: () => {}, replace: () => {}, back: () => {}, refresh: () => {}, prefetch: () => {} };
}
