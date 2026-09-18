import { parse } from 'csv-parse/sync'
import type { Language } from '@prisma/client'
import { z } from 'zod'
import { createGuest } from './guestService.js'

const rowSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  language: z.enum(['AR', 'HE', 'EN', 'ar', 'he', 'en']).default('EN'),
  maxGuestsAllowed: z.coerce.number().int().min(1).max(50).default(1),
  notes: z.string().optional().nullable(),
})

function normalizeLanguage(value: string): Language {
  return value.toUpperCase() as Language
}

export type ImportResult = {
  successCount: number
  failureCount: number
  failures: Array<{ row: number; reason: string; data?: unknown }>
}

/**
 * Validates all rows first. Creates guests only if every row is valid.
 */
export async function importGuestsFromCsv(csvText: string): Promise<ImportResult> {
  let records: Record<string, string>[]
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[]
  } catch (err) {
    return {
      successCount: 0,
      failureCount: 1,
      failures: [{ row: 0, reason: err instanceof Error ? err.message : 'Invalid CSV' }],
    }
  }

  const failures: ImportResult['failures'] = []
  const parsedRows: z.infer<typeof rowSchema>[] = []

  records.forEach((raw, index) => {
    const normalized = {
      name: raw.name ?? raw.fullName ?? raw.Name ?? '',
      phone: raw.phone ?? raw.phoneNumber ?? '',
      email: raw.email ?? '',
      language: raw.language ?? 'EN',
      maxGuestsAllowed: raw.maxGuestsAllowed ?? raw.max_guests ?? '1',
      notes: raw.notes ?? '',
    }
    const result = rowSchema.safeParse(normalized)
    if (!result.success) {
      failures.push({
        row: index + 2,
        reason: result.error.issues.map((i) => i.message).join('; '),
        data: normalized,
      })
      return
    }
    parsedRows.push(result.data)
  })

  if (failures.length > 0) {
    return { successCount: 0, failureCount: failures.length, failures }
  }

  for (const row of parsedRows) {
    await createGuest({
      fullName: row.name,
      phoneNumber: row.phone || null,
      email: row.email || null,
      language: normalizeLanguage(row.language),
      maxGuestsAllowed: row.maxGuestsAllowed,
      notes: row.notes || null,
    })
  }

  return { successCount: parsedRows.length, failureCount: 0, failures: [] }
}
