import { AppBar } from '@/components/layout/AppBar';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Shown while `/profile` reads the session and Firestore.
 *
 * The page is dynamic, so a `<Link>` cannot prefetch it. Without this file a
 * tap on the Profile tab shows nothing until the server answers. With it, the
 * link prefetches this shell, and the screen changes at once.
 */
export default function ProfileLoading(): React.JSX.Element {
  return (
    <>
      <AppBar title="Profile" back={{ fallbackHref: '/', label: 'Back to home' }} />
      <main className="mx-auto flex w-full max-w-md justify-center px-5 py-12">
        <Spinner label="Loading your profile" />
      </main>
    </>
  );
}
