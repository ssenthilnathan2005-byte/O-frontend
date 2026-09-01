import { useRef, useState, useCallback, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 70;
const MAX_PULL = 100;

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing]     = useState(false);
  const startY   = useRef(0);
  const pulling  = useRef(false);
  const scrollEl = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollEl.current && scrollEl.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && scrollEl.current && scrollEl.current.scrollTop <= 0) {
      setPullDistance(Math.min(delta * 0.5, MAX_PULL));
    } else {
      pulling.current = false;
      setPullDistance(0);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={scrollEl}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
      style={{ overscrollBehavior: "contain" }}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pullDistance }}
      >
        <RefreshCw
          className="w-5 h-5 text-teal-600"
          style={{
            transform: `rotate(${pullDistance * 3}deg)`,
            animation: refreshing ? "spin 0.8s linear infinite" : "none",
            opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
          }}
        />
      </div>
      {children}
    </div>
  );
}
