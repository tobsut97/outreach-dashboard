import { useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveProfileOwner, type ProfileName } from '@/filters'
import {
  detectOwner,
  fetchData,
  getJobStatus,
  startUpload,
  MAX_UPLOAD_BYTES,
  type JobStatus,
} from '@/lib/uploadApi'
import type { DashboardData } from '@/types'

type Stage =
  | { name: 'pick' }
  | { name: 'detecting' }
  | { name: 'confirm'; owner: string }
  | { name: 'running'; owner: string; job: JobStatus }
  | { name: 'error'; message: string }

const STATUS_LABEL: Record<JobStatus['status'], string> = {
  queued: 'Queued…',
  detecting: 'Detecting sender…',
  checking_ollama: 'Checking Ollama…',
  parsing: 'Parsing conversations…',
  classifying: 'Classifying replies…',
  done: 'Done',
  error: 'Failed',
}

const POLL_INTERVAL_MS = 1500

export function ProfileUpload({
  profile,
  onUploaded,
}: {
  profile: ProfileName
  onUploaded: (data: DashboardData) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>({ name: 'pick' })

  const pickFile = async (selected: File | null) => {
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setStage({ name: 'error', message: 'Please choose a .csv file.' })
      return
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      const mb = (selected.size / (1024 * 1024)).toFixed(1)
      setStage({ name: 'error', message: `That file is ${mb}MB — the limit is 50MB.` })
      return
    }
    setFile(selected)
    setStage({ name: 'detecting' })
    try {
      const detected = await detectOwner(selected)
      setStage({ name: 'confirm', owner: detected ?? '' })
    } catch (error) {
      setStage({ name: 'error', message: (error as Error).message })
    }
  }

  const runUpload = async (owner: string) => {
    if (!file) return
    try {
      const jobId = await startUpload(file, owner)
      setStage({ name: 'running', owner, job: { status: 'queued', processed: 0, total: 0, owner, message: '' } })

      const poll = async () => {
        const job = await getJobStatus(jobId)
        if (job.status === 'error') {
          setStage({ name: 'error', message: job.message })
          return
        }
        if (job.status === 'done') {
          saveProfileOwner(profile, owner)
          onUploaded(await fetchData())
          return
        }
        setStage({ name: 'running', owner, job })
        setTimeout(poll, POLL_INTERVAL_MS)
      }
      poll()
    } catch (error) {
      setStage({ name: 'error', message: (error as Error).message })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>No data yet for {profile}</CardTitle>
        <CardDescription>
          Upload their LinkedHelper profile-export CSV (up to 50MB) to classify it locally
          with Ollama — nothing leaves this machine.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {stage.name === 'pick' && (
          <label className="border-input hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors">
            <UploadCloud className="text-muted-foreground size-6" />
            <span className="text-sm font-medium">Click to choose a CSV file</span>
            <span className="text-muted-foreground text-xs">Up to 50MB</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />
          </label>
        )}

        {stage.name === 'detecting' && (
          <p className="text-muted-foreground text-sm">Detecting the account owner…</p>
        )}

        {stage.name === 'confirm' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-name">Account owner's name, as it appears in LinkedIn</Label>
              <Input
                id="owner-name"
                value={stage.owner}
                placeholder="e.g. Lara Müller"
                onChange={(event) => setStage({ name: 'confirm', owner: event.target.value })}
              />
              <p className="text-muted-foreground text-xs">
                Auto-detected from whoever sends messages across nearly every conversation
                in the file. Correct it if that's wrong before continuing.
              </p>
            </div>
            <Button
              className="w-fit"
              disabled={!stage.owner.trim()}
              onClick={() => runUpload(stage.owner.trim())}
            >
              Upload &amp; classify
            </Button>
          </div>
        )}

        {stage.name === 'running' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{STATUS_LABEL[stage.job.status]}</p>
            {stage.job.status === 'classifying' && stage.job.total > 0 && (
              <>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-[width]"
                    style={{ width: `${(100 * stage.job.processed) / stage.job.total}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {stage.job.processed} of {stage.job.total} replies classified
                </p>
              </>
            )}
          </div>
        )}

        {stage.name === 'error' && (
          <div className="flex flex-col gap-3">
            <p className="text-destructive text-sm">{stage.message}</p>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setStage({ name: 'pick' })}>
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
