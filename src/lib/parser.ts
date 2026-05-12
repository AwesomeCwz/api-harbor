import type { HARFile, HAREntry, HARTimings, ParsedAPI } from '../types/har'

function parseJSON(text: string | undefined): unknown {
  if (!text) return undefined
  try { return JSON.parse(text) } catch { return text }
}

function parseURL(raw: string): URL | null {
  try { return new URL(raw) } catch { return null }
}

function isValidAPI(url: string): boolean {
  try {
    const u = new URL(url)
    const skip = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)/i
    return !skip.test(u.pathname)
  } catch {
    return false
  }
}

function entryToAPI(entry: HAREntry, id: string, pages: Map<string, string>): ParsedAPI {
  const url = parseURL(entry.request.url)
  const timings: HARTimings = entry.timings ?? {
    blocked: 0, dns: 0, connect: 0, send: 0, wait: entry.time, receive: 0,
  }

  return {
    id,
    method: entry.request.method,
    pathname: url?.pathname ?? '',
    fullUrl: entry.request.url,
    status: entry.response.status,
    statusText: entry.response.statusText,
    time: entry.time,
    startedDateTime: entry.startedDateTime,

    queryParams: entry.request.queryString,
    requestHeaders: entry.request.headers,
    requestBody: parseJSON(entry.request.postData?.text),
    contentType: entry.request.postData?.mimeType ?? '',

    responseHeaders: entry.response.headers,
    responseBody: parseJSON(entry.response.content.text),
    responseType: entry.response.content.mimeType,

    host: url?.host ?? '',
    size: entry.response.content.size,

    timings,

    initiatorType: entry._initiator?.type ?? '',
    initiatorUrl: entry._initiator?.url ?? '',

    pageTitle: entry.pageref ? (pages.get(entry.pageref) ?? '') : '',
  }
}

let globalId = 0

export function parseHAR(raw: string, sourceFile: string): ParsedAPI[] {
  const har: HARFile = JSON.parse(raw)

  if (!har.log?.entries) {
    throw new Error('Invalid HAR file: missing log.entries')
  }

  const pages = new Map<string, string>()
  if (har.log.pages) {
    for (const p of har.log.pages) {
      pages.set(p.id, p.title)
    }
  }

  const apis: ParsedAPI[] = []

  for (const entry of har.log.entries) {
    if (!isValidAPI(entry.request.url)) continue
    apis.push({ ...entryToAPI(entry, String(++globalId), pages), sourceFile })
  }

  return apis
}

export type SortMode = 'startTime' | 'duration'

export function sortRequests(list: ParsedAPI[], mode: SortMode): ParsedAPI[] {
  return [...list].sort((a, b) => {
    if (mode === 'startTime') {
      return a.startedDateTime.localeCompare(b.startedDateTime)
    }
    return b.time - a.time
  })
}

export function guessFieldSchema(
  value: unknown,
  depth: number = 0
): FieldSchema | null {
  if (depth > 4) return null
  if (value === null || value === undefined) {
    return { name: '', type: 'null', required: false, description: '' }
  }
  if (Array.isArray(value)) {
    const item = guessFieldSchema(value[0], depth + 1)
    return {
      name: '',
      type: `array<${item?.type ?? 'unknown'}>`,
      required: false,
      description: '',
      children: item ? [item] : undefined,
    }
  }
  if (typeof value === 'object') {
    const children: FieldSchema[] = []
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const child = guessFieldSchema(v, depth + 1)
      if (child) {
        child.name = k
        children.push(child)
      }
    }
    return { name: '', type: 'object', required: false, description: '', children }
  }
  return { name: '', type: typeof value, required: false, description: '' }
}

export interface FieldSchema {
  name: string
  type: string
  required: boolean
  description: string
  children?: FieldSchema[]
}

function schemaToRows(schema: FieldSchema | null, prefix: string, depth: number): string[] {
  if (!schema || depth > 4) return []
  const rows: string[] = []
  const indent = '&emsp;'.repeat(depth)

  if (schema.type === 'object' && schema.children) {
    for (const child of schema.children) {
      const req = child.required ? '**•**' : ''
      rows.push(`| ${indent}${child.name} | \`${child.type}\` | ${req} |`)
      rows.push(...schemaToRows(child, '', depth + 1))
    }
  } else if (schema.type.startsWith('array<') && schema.children?.[0]) {
    const item = schema.children[0]
    if (item.type === 'object' && item.children) {
      for (const child of item.children) {
        const req = child.required ? '**•**' : ''
        rows.push(`| ${indent}${child.name} | \`${child.type}\` | ${req} |`)
        rows.push(...schemaToRows(child, '', depth + 1))
      }
    } else {
      rows.push(`| ${indent}*items* | \`${item.type}\` | |`)
    }
  } else {
    rows.push(`| ${indent}${prefix} | \`${schema.type}\` | |`)
  }
  return rows
}

export function exportAPIDoc(apis: ParsedAPI[]): string {
  const unique = new Map<string, ParsedAPI[]>()
  for (const api of apis) {
    const key = `${api.method} ${api.pathname}`
    const list = unique.get(key)
    if (list) list.push(api)
    else unique.set(key, [api])
  }

  const files = [...new Set(apis.map(a => a.sourceFile).filter(Boolean))]
  const lines: string[] = [
    '# API Documentation',
    '',
    `> ${files.length} file${files.length !== 1 ? 's' : ''} · ${apis.length} requests · ${unique.size} endpoints`,
    '',
    '---',
    '',
  ]

  for (const [key, entries] of unique) {
    const [method, path] = key.split(' ')
    const e = entries[0]
    const statuses = [...new Set(entries.map(x => x.status))]
    const times = entries.map(x => x.time)
    const reqSchema = e.requestBody !== undefined ? guessFieldSchema(e.requestBody) : null
    const resSchema = e.responseBody !== undefined ? guessFieldSchema(e.responseBody) : null

    lines.push(`## ${method} \`${path}\``)
    lines.push('')

    // Request body fields
    if (reqSchema && (reqSchema.type === 'object' || reqSchema.type.startsWith('array<'))) {
      lines.push('### Request Body')
      lines.push('')
      lines.push('| Field | Type | Required |')
      lines.push('|-------|------|----------|')
      lines.push(...schemaToRows(reqSchema, '', 0))
      lines.push('')
    }

    // Response body fields
    if (resSchema && (resSchema.type === 'object' || resSchema.type.startsWith('array<'))) {
      lines.push('### Response Body')
      lines.push('')
      lines.push('| Field | Type | Required |')
      lines.push('|-------|------|----------|')
      lines.push(...schemaToRows(resSchema, '', 0))
      lines.push('')
    }

    // Info row
    lines.push(`| | | |`)
    lines.push(`|---|---|---|`)
    lines.push(`| **Host** | \`${e.host}\` | |`)
    lines.push(`| **Type** | \`${e.responseType || '—'}\` | |`)
    lines.push(`| **Calls** | ${entries.length} | |`)
    lines.push(`| **Status** | ${statuses.join(', ')} | |`)
    lines.push(`| **Avg** | ${(times.reduce((s, t) => s + t, 0) / times.length).toFixed(2)}ms | |`)

    if (e.queryParams.length > 0) {
      lines.push('')
      lines.push('**Query params:**')
      for (const p of e.queryParams) {
        lines.push(`- \`${p.name}\` = \`${p.value}\``)
      }
    }

    if (e.requestHeaders.length > 0) {
      lines.push('')
      lines.push('**Request headers:**')
      for (const h of e.requestHeaders) {
        lines.push(`- \`${h.name}\`: ${h.value}`)
      }
    }

    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}
