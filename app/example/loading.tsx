import { Spinner } from '@/components/ui/Spinner';

/**
 * Shown while `/example` reads Firestore and signs image URLs. The page is
 * dynamic, so without this file a link to it shows nothing until the server
 * answers. Delete it with the rest of the example.
 */
export default function ExampleLoading(): React.JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl justify-center px-4 py-10 sm:px-6 sm:py-16">
      <Spinner label="Loading examples" />
    </main>
  );
}
