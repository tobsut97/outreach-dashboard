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
import { ANSWERS, PROFILES, type AnswerName, type ProfileName } from '@/filters'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  profile: ProfileName
  answer: AnswerName
  onProfileChange: (profile: ProfileName) => void
  onAnswerChange: (answer: AnswerName) => void
}

export function AppSidebar({
  profile,
  answer,
  onProfileChange,
  onAnswerChange,
  ...props
}: AppSidebarProps) {
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
                  >
                    {entry.name}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Answers</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ANSWERS.map((entry) => (
                <SidebarMenuItem key={entry.name}>
                  <SidebarMenuButton
                    isActive={answer === entry.name}
                    onClick={() => onAnswerChange(entry.name)}
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
