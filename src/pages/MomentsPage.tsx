import { useSearchParams } from 'react-router-dom'
import { MomentsExperience } from '../moments/MomentsExperience'

export function MomentsPage() {
  const [params] = useSearchParams()
  const table = params.get('t')?.trim().slice(0, 20) || null
  return <MomentsExperience table={table} />
}
