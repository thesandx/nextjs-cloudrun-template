/**
 * The page transition. Next.js remounts a template on every navigation (a
 * layout it keeps), so the class below replays each time the user moves to a
 * new screen: the page settles up into place, as a screen does in a native app.
 *
 * A Server Component, and the animation is CSS, so it ships no JavaScript.
 * It starts from a visible state, so the first paint and Largest Contentful
 * Paint are not delayed. The TabBar lives in the layout, outside this wrapper,
 * so it stays still while the page moves. See design-language.md > Motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-enter">{children}</div>;
}
