import { Waypoints } from 'lucide-react'
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
  pipelineActive: boolean
}

const ACTIVE_CLASSNAME = 'data-active:bg-neutral-300! data-active:hover:bg-neutral-300!'

export function AppSidebar({ profile, onProfileChange, pipelineActive, ...props }: AppSidebarProps) {
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
                    isActive={!pipelineActive && profile === entry.name}
                    onClick={() => onProfileChange(entry.name)}
                    className={ACTIVE_CLASSNAME}
                  >
                    {entry.name}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Pipeline</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pipelineActive} className={ACTIVE_CLASSNAME} render={
                  <a href="#/pipeline">
                    <Waypoints />
                    HubSpot Pipeline
                  </a>
                } />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
