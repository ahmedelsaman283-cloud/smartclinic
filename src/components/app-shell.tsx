import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/use-clinic";


export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

export function AppShell({
  title,
  subtitle,
  nav,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/staff", replace: true });
  }

  const { data: clinic } = useClinic();

  return (
    <div className="min-h-screen bg-secondary/40 pb-24">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            {clinic ? (
              <p className="mb-0.5 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-primary">
                {clinic.name}
              </p>
            ) : null}
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>

          <div className="flex items-center gap-2">
            {action}
            <button
              onClick={handleSignOut}
              aria-label="تسجيل الخروج"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-2">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-primary bg-accent" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex min-w-16 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors"
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-border/70 bg-card p-4 shadow-[0_8px_24px_oklch(0.55_0.05_255/0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
