import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ANSWERS, type AnswerName } from '@/filters'

export function SentimentSelect({
  value,
  onChange,
}: {
  value: AnswerName
  onChange: (value: AnswerName) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as AnswerName)
      }}
    >
      <SelectTrigger className="w-36">
        <SelectValue>{(current: AnswerName) => current}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ANSWERS.map((entry) => (
          <SelectItem key={entry.name} value={entry.name}>
            {entry.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
