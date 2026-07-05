import { Loader2 } from "lucide-react";

export function PageSpinner() {
  return (
    <div className="flex w-full items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}
