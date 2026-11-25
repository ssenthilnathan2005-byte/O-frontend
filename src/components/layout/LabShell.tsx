import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { useBodyScrollLock } from "../../lib/useBodyScrollLock";

export type LabNavItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
};

type Props = {
  title: string;
  subtitle: string;
  logo: ComponentType<{ className?: string }>;
  items: LabNavItem[];
  active: string;
  onSelect: (key: string) => void;
  onLogout: () => void;
  children: ReactNode;
};

// Same look as the Hospital Admin console: dark sidebar, teal active marker,
// mobile top bar with a slide-in drawer, and one scrolling content area.
export default function LabShell({ title, subtitle, logo: Logo, items, active, onSelect, onLogout, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useBodyScrollLock(drawerOpen);
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => { html.style.overflow = prevHtml; body.style.overflow = prevBody; };
  }, []);

  function navList(onDone?: () => void) {
    return items.map(({ key, label, icon: Icon, badge }) => (
      <button
        key={key}
        type="button"
        onClick={() => { onSelect(key); onDone?.(); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          active === key ? "bg-white/15 text-white border-l-2 border-teal-400" : "text-white/60 hover:bg-white/8 hover:text-white/90"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-left leading-tight">{label}</span>
        {badge != null && badge > 0 && (
          <span className="ml-auto rounded-full bg-teal-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{badge > 99 ? "99+" : badge}</span>
        )}
      </button>
    ));
  }

  return (
    <div className="fixed inset-0 z-[60] flex overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 h-full overflow-hidden bg-admin-sidebar text-admin-sidebar-fg flex-col shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
              <Logo className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate">{title}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">{subtitle}</p>
            </div>
          </div>
        </div>
        <nav className="violet-scroll-dark flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
          {navList()}
        </nav>
        <div className="px-3 pt-4 pb-6 border-t border-white/10 shrink-0">
          <button type="button" onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-admin-sidebar text-white flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <Logo className="w-5 h-5 shrink-0" />
          <span className="font-bold text-sm truncate">{title}</span>
        </div>
        <button type="button" onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <button type="button" aria-label="Close menu" className="lg:hidden fixed inset-0 z-50 bg-black/50 cursor-default" onClick={() => setDrawerOpen(false)} />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 w-72 z-50 bg-admin-sidebar flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Logo className="w-6 h-6 text-white shrink-0" />
                <p className="font-bold text-white text-sm truncate">{title}</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <nav className="violet-scroll-dark flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3 py-4 space-y-1">
              {navList(() => setDrawerOpen(false))}
            </nav>
            <div className="px-3 pt-4 pb-6 border-t border-white/10 shrink-0">
              <button type="button" onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </>
      )}

      <main className="violet-scroll flex-1 min-w-0 h-full overflow-y-auto overscroll-contain lg:pt-0 pt-14">
        <div className="mx-auto w-full max-w-[1760px]">{children}</div>
      </main>
    </div>
  );
}
