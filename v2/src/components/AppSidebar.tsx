import { X } from 'lucide-react'
import { PinaLogo } from '@/components/PinaLogo'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { PROFILES, type ProfileName } from '@/filters'
import type { ManagedConversation } from '@/lib/overrides'

/** The conversations behind one selected finding from the insights callout — shown in the
 * sidebar rather than a new list component, per how the rest of the app surfaces conversation
 * lists (see SentimentDetail's table for the other place this happens). */
export interface HighlightedConversations {
  label: string
  conversations: ManagedConversation[]
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  profile: ProfileName
  onProfileChange: (profile: ProfileName) => void
  highlighted: HighlightedConversations | null
  onClearHighlighted: () => void
  onSelectConversation: (conversation: ManagedConversation) => void
}

export function AppSidebar({
  profile,
  onProfileChange,
  highlighted,
  onClearHighlighted,
  onSelectConversation,
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

        {highlighted && (
          <SidebarGroup className="relative">
            <SidebarGroupLabel>{highlighted.label}</SidebarGroupLabel>
            <SidebarGroupAction title="Clear" onClick={onClearHighlighted}>
              <X />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {highlighted.conversations.length === 0 ? (
                  <p className="text-sidebar-foreground/60 px-2 py-1.5 text-xs">
                    No conversations match.
                  </p>
                ) : (
                  highlighted.conversations.map((conversation) => (
                    <SidebarMenuItem
                      key={conversation.profile_url || conversation.full_name}
                    >
                      <SidebarMenuButton onClick={() => onSelectConversation(conversation)}>
                        {conversation.full_name || 'Unknown'}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
