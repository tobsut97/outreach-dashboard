import { Leaf } from 'lucide-react'
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Leaf className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Pina Earth</span>
                <span className="text-muted-foreground truncate text-xs">Outreach</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
