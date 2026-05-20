"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Home, 
  FileUser, 
  FileText, 
  Dumbbell, 
  TrendingUp, 
  Settings,
  Brain,
  ArrowRight,
  BarChart2
} from "lucide-react";
import type { ReactElement } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Resume Library", href: "/resume", icon: FileUser },
  { label: "Role Library", href: "/jd", icon: FileText },
  { label: "Practice", href: "/session/new", icon: Dumbbell },
  { label: "Performance", href: "/progress", icon: TrendingUp },
  { label: "Reports", href: "/reports", icon: BarChart2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): ReactElement {
  const pathname = usePathname();

  // If we are in an active live session, hide the Sidebar for a clean, full-screen focused experience!
  const isLiveSession = pathname.startsWith("/session/") && pathname !== "/session/new";

  if (isLiveSession) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground h-screen flex overflow-hidden antialiased">
      {/* SideNavBar */}
      <nav className="h-screen w-64 fixed left-0 top-0 border-r border-border shadow-none bg-card flex flex-col p-stack-md gap-stack-sm z-40">
        {/* Header / Identity */}
        <div className="mb-stack-lg px-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            P
          </div>
          <h1 className="font-display text-2xl font-bold text-brand-700 tracking-tight">Praxo</h1>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all active:scale-98 font-label-md text-label-md ${
                  isActive
                    ? "text-brand-700 font-bold bg-brand-500/10"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-brand-700" : "text-muted-foreground"}`} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* CTA & Status Footer */}
        <div className="mt-auto flex flex-col gap-stack-md px-2 pt-stack-md border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
              <Brain className="h-4 w-4 text-brand-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-foreground">AI Readiness</span>
              <span className="font-label-md text-label-md text-accent-600 font-bold">92%</span>
            </div>
          </div>
          <Link
            href="/session/new"
            className="w-full bg-brand-500 text-white py-2 rounded-lg font-label-md text-label-md flex justify-center items-center gap-2 hover:opacity-90 transition-opacity"
          >
            Start Session
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* Main Content Canvas */}
      <main className="flex-1 ml-64 h-full overflow-y-auto overflow-x-hidden relative">
        {/* Subtle luminous background effect */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-muted/20 to-transparent opacity-50 pointer-events-none -z-10" />
        <div className="max-w-container-max mx-auto px-margin-desktop py-stack-lg flex flex-col gap-stack-lg min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
