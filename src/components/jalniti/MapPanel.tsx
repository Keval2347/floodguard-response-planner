import { lazy, Suspense, useEffect, useState } from "react";

import type { Assignment, ScoredSegment } from "@/lib/jalniti/model";

// Leaflet touches `window` at import time, so it can only load after hydration.
const WardMap = lazy(() => import("./WardMap"));

interface Props {
  segments: ScoredSegment[];
  assignments: Assignment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showRoutes: boolean;
}

export default function MapPanel(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Loading ward map…
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          Loading ward map…
        </div>
      }
    >
      <WardMap {...props} />
    </Suspense>
  );
}
