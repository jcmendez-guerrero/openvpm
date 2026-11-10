"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PawPrint,
  Users,
  Calendar,
  FileText,
  Receipt,
  Package,
  MessageSquare,
  Syringe,
  BellRing,
  ClipboardList,
  BarChart3,
  Settings,
  ShieldAlert,
  Bot,
  FlaskConical,
  Archive,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { PawMark } from "@/components/brand/paw-mark";
import { useTranslations } from "use-intl";
import { MyLanguageSwitch } from "@/components/layout/my-language-switch";

type UserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

const allRoles: UserRole[] = [
  "admin",
  "veterinarian",
  "technician",
  "front_desk",
  "viewer",
];

function isUserRole(role?: string | null): role is UserRole {
  return allRoles.includes(role as UserRole);
}

const navItems: {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  roles: UserRole[];
}[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard, roles: allRoles },
  { href: "/patients", labelKey: "patients", icon: PawPrint, roles: allRoles },
  { href: "/clients", labelKey: "clients", icon: Users, roles: allRoles },
  { href: "/schedule", labelKey: "schedule", icon: Calendar, roles: allRoles },
  { href: "/records", labelKey: "records", icon: FileText, roles: allRoles },
  {
    href: "/lab-results",
    labelKey: "labInbox",
    icon: FlaskConical,
    roles: ["admin", "veterinarian", "technician", "front_desk", "viewer"],
  },
  { href: "/billing", labelKey: "billing", icon: Receipt, roles: allRoles },
  { href: "/inventory", labelKey: "inventory", icon: Package, roles: allRoles },
  { href: "/inbox", labelKey: "inbox", icon: MessageSquare, roles: allRoles },
  {
    href: "/recalls",
    labelKey: "recalls",
    icon: Syringe,
    roles: ["admin", "veterinarian", "front_desk"],
  },
  {
    href: "/care-reminders",
    labelKey: "careReminders",
    icon: BellRing,
    roles: allRoles,
  },
  {
    href: "/migration-archive",
    labelKey: "importedHistory",
    icon: Archive,
    roles: allRoles,
  },
  {
    href: "/whiteboard",
    labelKey: "whiteboard",
    icon: ClipboardList,
    roles: allRoles,
  },
  {
    href: "/agent",
    labelKey: "agent",
    icon: Bot,
    roles: ["admin", "veterinarian"],
  },
  {
    href: "/controlled-substances",
    labelKey: "controlledSubstances",
    icon: ShieldAlert,
    roles: ["admin", "veterinarian"],
  },
  {
    href: "/reports",
    labelKey: "reports",
    icon: BarChart3,
    roles: ["admin", "veterinarian"],
  },
  { href: "/settings", labelKey: "settings", icon: Settings, roles: ["admin"] },
];

type SidebarProps = {
  className?: string;
  collapsible?: boolean;
  onNavigate?: () => void;
  width?: "fixed" | "full";
};

export function Sidebar({
  className,
  collapsible = true,
  onNavigate,
  width = "fixed",
}: SidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations("shell");
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = isUserRole(session?.user?.role) ? session.user.role : undefined;
  const { data: branding } = trpc.settings.getBranding.useQuery();
  const isCollapsed = collapsible && collapsed;
  const canShowNav = status === "authenticated" && role !== undefined;
  const { data: unreadInbox } = trpc.communications.listConversations.useQuery(
    { inboxFilter: "unread", limit: 1, offset: 0 },
    {
      enabled: canShowNav,
      refetchInterval: 30000,
      retry: false,
    },
  );
  const visibleNavItems = canShowNav
    ? navItems.filter((item) => item.roles.includes(role))
    : [];
  const unreadInboxCount = Math.max(0, Number(unreadInbox?.total ?? 0));
  const unreadInboxLabel =
    unreadInboxCount > 99 ? "99+" : String(unreadInboxCount);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-surface transition-all duration-150",
        width === "full" ? "w-full" : isCollapsed ? "w-16" : "w-60",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name ?? t("practiceLogo")}
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <PawMark className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          {!isCollapsed && (
            <span className="font-heading text-lg font-semibold">OpenVPM</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-2"
        role="navigation"
        aria-label={t("mainNavigation")}
      >
        <ul className="space-y-0.5">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href) ||
                  (item.href === "/lab-results" && pathname === "/lab-reports");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-tour={`nav-${item.href}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <span className="relative shrink-0">
                    <item.icon className="h-4 w-4" />
                    {isCollapsed &&
                    item.href === "/inbox" &&
                    unreadInboxCount > 0 ? (
                      <span
                        aria-label={t("unreadInbox", { count: unreadInboxCount })}
                        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface"
                      />
                    ) : null}
                  </span>
                  {!isCollapsed && (
                    <span className="truncate">{t(`nav.${item.labelKey}`)}</span>
                  )}
                  {!isCollapsed &&
                  item.href === "/inbox" &&
                  unreadInboxCount > 0 ? (
                    <span
                      aria-label={t("unreadInbox", { count: unreadInboxCount })}
                      className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
                    >
                      {unreadInboxLabel}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-border p-2">
        {session?.user && !isCollapsed && (
          <div className="mb-2 flex items-center gap-3 rounded-md px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {session.user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {session.user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground capitalize">
                {role ? t(`roles.${role}`) : session.user.role?.replace("_", " ")}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label={t("signOut")}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        {session?.user && !isCollapsed && <MyLanguageSwitch className="mb-2 px-3" />}
        {collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
            className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
