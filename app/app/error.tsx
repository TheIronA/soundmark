"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">Something went wrong.</p>
        <p className="text-sm text-muted-foreground">
          Please try again.
        </p>
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
