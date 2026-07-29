import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function App() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>shadcn/ui is working</CardTitle>
          <CardDescription>
            v2 is scaffolded on Vite, React, Tailwind, and shadcn/ui.
          </CardDescription>
          <CardAction>
            <Badge>v2</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </CardContent>
      </Card>
    </main>
  )
}

export default App
