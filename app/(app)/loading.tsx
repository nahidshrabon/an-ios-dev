import { SpinnerIcon } from "@/components/Icons";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <SpinnerIcon className="size-8 animate-spin text-zinc-400 dark:text-zinc-600" />
    </div>
  );
}
