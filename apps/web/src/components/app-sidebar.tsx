"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@torea/ui/components/ui/sidebar";
import {
  CreditCardIcon,
  LayoutDashboardIcon,
  PlugIcon,
  Settings2Icon,
  UserCogIcon,
  UserPlusIcon,
  VideoIcon,
  WebhookIcon,
} from "lucide-react";
import { NavMain, type NavSection } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";

const navSections: NavSection[] = [
  {
    label: "概要",
    items: [
      {
        title: "ダッシュボード",
        url: "/dashboard",
        icon: <LayoutDashboardIcon />,
      },
      {
        title: "録画",
        url: "/dashboard/recordings",
        icon: <VideoIcon />,
      },
    ],
  },
  {
    label: "設定",
    items: [
      {
        title: "メンバー",
        url: "/dashboard/members",
        icon: <UserPlusIcon />,
      },
      {
        title: "組織設定",
        url: "/dashboard/settings",
        icon: <Settings2Icon />,
      },
      {
        title: "連携",
        url: "/dashboard/settings/integrations",
        icon: <PlugIcon />,
      },
      {
        title: "課金",
        url: "/dashboard/settings/billing",
        icon: <CreditCardIcon />,
      },
      {
        title: "Webhook",
        url: "/dashboard/webhooks",
        icon: <WebhookIcon />,
      },
      {
        title: "アカウント",
        url: "/dashboard/account",
        icon: <UserCogIcon />,
      },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={navSections} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
