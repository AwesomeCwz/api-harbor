import { useMemo } from 'react'

interface Props { data: unknown }

const KW = ['true', 'false', 'null'] as const

function highlightJSON(json: string): string {
  let html = ''
  let i = 0
  const len = json.length

  outer:
  while (i < len) {
    const ch = json[i]

    if (ch === '"') {
      let j = i + 1; let escaped = false
      while (j < len && (json[j] !== '"' || escaped)) { escaped = json[j] === '\\' && !escaped; j++ }
      j++
      const str = json.slice(i, j)
      let k = j; while (k < len && json[k] === ' ') k++
      if (json[k] === ':') html += `<span class="json-key">${esc(str)}</span>`
      else html += `<span class="json-string">${esc(str)}</span>`
      i = j; continue
    }

    if (/^-?\d/.test(ch) && (i === 0 || /[\s:,\[\{]/.test(json[i - 1]))) {
      let j = i; while (j < len && /[\d.eE+\-]/.test(json[j])) j++
      html += `<span class="json-number">${esc(json.slice(i, j))}</span>`
      i = j; continue
    }

    for (const kw of KW) {
      if (json.slice(i, i + kw.length) === kw) {
        const cls = kw === 'null' ? 'json-null' : 'json-bool'
        html += `<span class="${cls}">${kw}</span>`
        i += kw.length; continue outer
      }
    }

    html += esc(ch); i++
  }
  return html
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatJSON(data: unknown): string {
  if (data === undefined || data === null) return String(data)
  try { return JSON.stringify(data, null, 2) } catch { return String(data) }
}

export default function JsonViewer({ data }: Props) {
  const html = useMemo(() => { return highlightJSON(formatJSON(data)) }, [data])

  if (data === undefined) {
    return <div className="text-[#b8b5ae] text-sm italic py-4">No data</div>
  }

  return (
    <pre className="bg-[#f5f3ef] text-[13px] leading-relaxed p-4 rounded-lg border border-[#e4e1db]
                    overflow-auto font-mono text-[#1a1a18]"
         dangerouslySetInnerHTML={{ __html: html }} />
  )
}
