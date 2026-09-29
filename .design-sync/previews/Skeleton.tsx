import { Skeleton } from 'nextjs-cloudrun-template';

export const ListRow = () => (
  <div className="flex max-w-md items-center gap-3">
    <Skeleton shape="circle" className="size-11" />
    <div className="flex flex-1 flex-col gap-2">
      <Skeleton className="w-3/5" />
      <Skeleton className="w-2/5" />
    </div>
  </div>
);

export const CardBlock = () => (
  <div className="flex max-w-md flex-col gap-3">
    <Skeleton shape="block" className="h-32 w-full" />
    <Skeleton className="w-4/5" />
    <Skeleton className="w-1/2" />
  </div>
);
