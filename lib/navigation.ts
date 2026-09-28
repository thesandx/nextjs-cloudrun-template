/**
 * The app's top-level destinations. One list, drawn two ways: the `TabBar` at
 * the bottom of a phone, and the `SiteHeader` links at the top of a desktop.
 * See design-language.md > Responsive: an app on a phone, a website on a desktop.
 *
 * Keep it to three to five. A destination here is a place the user goes back
 * to often, not every page in the app. Pages below a tab use `AppBar` with a
 * back arrow instead.
 */

export type TabIcon = 'home' | 'shapes' | 'person';

export interface AppTab {
  href: string;
  label: string;
  icon: TabIcon;
}

export const APP_TABS: readonly AppTab[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/design', label: 'Components', icon: 'shapes' },
  { href: '/profile', label: 'Profile', icon: 'person' },
];

/**
 * Screens that hide the tab bar: a focused task the user should finish or
 * leave with the back arrow, as in a native app's sign-in flow.
 */
export const TABLESS_PATHS: readonly string[] = ['/sign-in'];

/** True when `pathname` is the tab's page or a page below it. */
export function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === '/') return pathname === '/';
  return pathname === tabHref || pathname.startsWith(`${tabHref}/`);
}

/** The `href` of the destination that `pathname` sits under, if any. */
export function activeTabHref(pathname: string): string | undefined {
  return APP_TABS.find((tab) => isTabActive(tab.href, pathname))?.href;
}
