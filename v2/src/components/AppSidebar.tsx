import { PinaLogo } from '@/components/PinaLogo'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { PROFILES, type ProfileName } from '@/filters'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  profile: ProfileName
  onProfileChange: (profile: ProfileName) => void
}

export function AppSidebar({ profile, onProfileChange, ...props }: AppSidebarProps) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="flex flex-col gap-2 px-2 py-1.5">
          <PinaLogo className="h-8 w-auto self-start" />
          <span className="text-muted-foreground text-xs">Outreach Dashboard</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Profiles</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PROFILES.map((entry) => (
                <SidebarMenuItem key={entry.name}>
                  <SidebarMenuButton
                    isActive={profile === entry.name}
                    onClick={() => onProfileChange(entry.name)}
                    className="data-active:bg-neutral-300! data-active:hover:bg-neutral-300!"
                  >
                    {entry.name}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
