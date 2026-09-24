/**
 * The app's top-level destinations — the tabs in `TabBar`.
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
