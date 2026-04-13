"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@screenbase/ui/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  Settings2Icon,
  UserCogIcon,
  UserPlusIcon,
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
