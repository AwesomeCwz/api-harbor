import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ParsedAPI } from '../types/har'
import { guessFieldSchema } from '../lib/parser'
import type { FieldSchema } from '../lib/parser'
import JsonViewer from './JsonViewer'

interface Props { request: ParsedAPI; onClose: () => void }

type Tab = 'headers' | 'request' | 'response' | 'timing'

const TABS: { key: Tab; label: string }[] = [
  { key: 'headers', label: 'Headers' },
  { key: 'request', label: 'Request' },
  { key: 'response', label: 'Response' },
  { key: 'timing', label: 'Timing' },
]

const METHOD_COLOR: Record<string, string> = {
  GET:    'text-[#137333] border-[#a8d8b9] bg-[#e6f4ea]',
  POST:   'text-[#1967d2] border-[#a8c8fa] bg-[#e8f0fe]',
  PUT:    'text-[#b06000] border-[#f0c960] bg-[#fef7e0]',
  PATCH:  'text-[#e37400] border-[#f0b870] bg-[#fff3e0]',
  DELETE: 'text-[#c5221f] border-[#f0a8a8] bg-[#fce8e6]',
}

const TIMING_KEYS = [
  { key: 'blocked', label: 'Blocked', color: '#b8b5ae' },
  { key: 'dns', label: 'DNS Lookup', color: '#5ea3d9' },
  { key: 'connect', label: 'Connect', color: '#c97dd9' },
  { key: 'ssl', label: 'SSL', color: '#a57dd9' },
  { key: 'send', label: 'Send', color: '#5ec9c9' },
  { key: 'wait', label: 'Wait (TTFB)', color: '#5ebf7e' },
  { key: 'receive', label: 'Receive', color: '#5e8fd9' },
]

function SchemaTree({ schema, depth, path, onSelectField, maxDepth }: {
  schema: FieldSchema; depth: number; path: string[]; onSelectField: (path: string[]) => void; maxDepth: number
}) {
  const indent = depth * 20
  const isContainer = schema.type === 'object' || schema.type.startsWith('array<')
  const isArray = schema.type.startsWith('array<')
  const fieldPath = schema.name ? [...path, schema.name] : path

  return (
    <div>
      <div
        className="flex items-center gap-2 py-0.5 font-mono text-[13px] cursor-pointer
                   hover:bg-[#fef5f3] rounded transition-colors -ml-1 px-1"
        style={{ paddingLeft: indent }}
        onClick={() => schema.name && onSelectField(fieldPath)}
        title={schema.name ? fieldPath.join('.') : undefined}
      >
        {schema.name && <span className="text-[#1a1a18] font-medium">{schema.name}</span>}
        <span className={schema.required ? 'text-[#d4543c]' : 'text-[#c4c1b8]'}>{schema.required ? '*' : '?'}</span>
        <span className="text-[#d4543c]">{schema.type}</span>
        {schema.description && <span className="text-[#8b8b82] text-xs truncate">{schema.description}</span>}
      </div>
      {isContainer && schema.children && depth < maxDepth &&
        schema.children.map((c, i) => (
          <SchemaTree key={i} schema={c} depth={isArray ? depth : depth + 1}
            path={isArray ? fieldPath : fieldPath}
            onSelectField={onSelectField} maxDepth={maxDepth} />
        ))}
    </div>
  )
}

function HeaderTable({ rows }: { rows: { name: string; value: string }[] }) {
  return (
    <table className="w-full text-sm border border-[#e4e1db] rounded-lg">
      <thead className="bg-[#f5f3ef]">
        <tr>
          <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#8b8b82] uppercase tracking-wider w-[220px]">Name</th>
          <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#8b8b82] uppercase tracking-wider">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-[#f0ede8]">
            <td className="px-3 py-1.5 font-mono text-[13px] text-[#1a1a18] whitespace-nowrap">{r.name}</td>
            <td className="px-3 py-1.5 font-mono text-[13px] text-[#6b6b65] break-all">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function RequestDrawer({ request: r, onClose }: Props) {
  const STORAGE_KEY = 'api-harbor-max-schema-depth'

  const [tab, setTab] = useState<Tab>('headers')
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [highlightPath, setHighlightPath] = useState<string[]>([])
  const [maxDepth, setMaxDepth] = useState(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v) return Number(v) } catch {}
    return 5
  })

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const setDepth = useCallback((v: number) => {
    setMaxDepth(v)
    try { localStorage.setItem(STORAGE_KEY, String(v)) } catch {}
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 220)
  }, [onClose])

  const requestSchema = useMemo(() => (r.requestBody ? guessFieldSchema(r.requestBody, 0, maxDepth) : null), [r.requestBody, maxDepth])
  const responseSchema = useMemo(() => (r.responseBody ? guessFieldSchema(r.responseBody, 0, maxDepth) : null), [r.responseBody, maxDepth])

  const copyJson = (data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const sd = String(r.status)[0]
  const statusCls = sd === '2' ? 'text-[#137333]' : sd === '3' ? 'text-[#1967d2]' : sd === '4' ? 'text-[#b06000]' : 'text-[#c5221f]'

  const timingTotal = Object.values(r.timings).reduce<number>((s, v) => s + (v ?? 0), 0)
  const timingMax = Math.max(...Object.values(r.timings).map(v => v ?? 0), 1)

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/30 drawer-backdrop ${visible ? 'open' : ''}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-[820px] max-w-[94vw] bg-white
                    border-l border-[#e4e1db] flex flex-col shadow-2xl drawer-panel ${visible ? 'open' : ''}`}
        role="dialog" aria-modal="true"
      >
        {/* Close + Header */}
        <div className="shrink-0 px-5 py-3 border-b border-[#e4e1db] flex items-center gap-3">
          <button onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-md
                       border border-[#e4e1db] text-[#8b8b82]
                       hover:text-[#1a1a18] hover:border-[#c4c1b8] hover:bg-[#f5f3ef] transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border
            ${METHOD_COLOR[r.method] ?? 'text-[#6b6b65] border-[#c4c1b8] bg-[#f5f3ef]'}`}>
            {r.method}
          </span>
          <span className="text-[13px] font-mono text-[#1a1a18] truncate flex-1">{r.pathname}</span>
        </div>

        {/* Meta */}
        <div className="shrink-0 px-5 py-2 border-b border-[#e4e1db] flex flex-wrap items-center gap-x-5 gap-y-1">
          <Meta label="Host" value={r.host} />
          <Meta label="Status"><span className={`font-semibold ${statusCls}`}>{r.status} {r.statusText}</span></Meta>
          <Meta label="Duration" value={`${r.time.toFixed(2)}ms`} mono />
          <Meta label="Size" value={`${(r.size / 1024).toFixed(1)} KB`} mono />
          {r.initiatorType && <Meta label="Initiator" value={r.initiatorType} />}
          <div className="ml-auto">
            <DepthInput value={maxDepth} onChange={setDepth} />
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-[#e4e1db] px-5">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`relative px-4 py-2.5 text-[12px] font-medium transition-colors
                ${tab === key ? 'text-[#1a1a18]' : 'text-[#8b8b82] hover:text-[#4a4a42]'}`}>
              {label}
              {tab === key && <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-[#d4543c] rounded-full" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {tab === 'headers' && (
            <div className="space-y-5">
              <Section title="Request Headers" count={r.requestHeaders.length}><HeaderTable rows={r.requestHeaders} /></Section>
              <Section title="Response Headers" count={r.responseHeaders.length}><HeaderTable rows={r.responseHeaders} /></Section>
              {r.queryParams.length > 0 && (
                <Section title="Query Parameters" count={r.queryParams.length}><HeaderTable rows={r.queryParams} /></Section>
              )}
            </div>
          )}

          {tab === 'request' && (
            <div className="space-y-5">
              <Section title="Full URL">
                <code className="block bg-[#f5f3ef] px-3 py-2 rounded-md text-[13px] text-[#1a1a18]
                                 break-all font-mono leading-relaxed border border-[#e4e1db]">
                  {r.fullUrl}
                </code>
              </Section>
              {r.requestBody !== undefined ? (
                <Section title="Request Body" subtitle={r.contentType || undefined}>
                  {requestSchema && (requestSchema.type === 'object' || requestSchema.type.startsWith('array<')) && requestSchema.children && (
                    <div className="bg-[#f5f3ef] p-3 rounded-lg mb-3 border border-[#e4e1db]">
                      <div className="text-[10px] font-semibold text-[#8b8b82] uppercase tracking-wider mb-2">Schema</div>
                      <SchemaTree schema={requestSchema} depth={0} path={[]} onSelectField={setHighlightPath} maxDepth={maxDepth} />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-[#8b8b82] uppercase tracking-wider">Raw</span>
                    <CopyBtn onClick={() => copyJson(r.requestBody)} copied={copied} />
                  </div>
                  <JsonViewer data={r.requestBody} highlightPath={highlightPath} />
                </Section>
              ) : <div className="text-[#8b8b82] text-sm italic">No request body</div>}
            </div>
          )}

          {tab === 'response' && (
            <div className="space-y-5">
              {r.responseBody !== undefined ? (
                <Section title="Response Body" subtitle={r.responseType || undefined}>
                  {responseSchema && (responseSchema.type === 'object' || responseSchema.type.startsWith('array<')) && responseSchema.children && (
                    <div className="bg-[#f5f3ef] p-3 rounded-lg mb-3 border border-[#e4e1db]">
                      <div className="text-[10px] font-semibold text-[#8b8b82] uppercase tracking-wider mb-2">Schema</div>
                      <SchemaTree schema={responseSchema} depth={0} path={[]} onSelectField={setHighlightPath} maxDepth={maxDepth} />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-[#8b8b82] uppercase tracking-wider">Raw</span>
                    <CopyBtn onClick={() => copyJson(r.responseBody)} copied={copied} />
                  </div>
                  <JsonViewer data={r.responseBody} highlightPath={highlightPath} />
                </Section>
              ) : <div className="text-[#8b8b82] text-sm italic">No response body</div>}
            </div>
          )}

          {tab === 'timing' && (
            <div className="space-y-5">
              <Section title="Timing Breakdown" subtitle={`Total: ${r.time.toFixed(2)}ms`}>
                <div className="space-y-3">
                  <div className="h-8 rounded-md overflow-hidden flex bg-[#f5f3ef] border border-[#e4e1db]">
                    {TIMING_KEYS.map(({ key, color }) => {
                      const ms = (r.timings as any)[key] ?? 0
                      if (ms <= 0 || timingTotal <= 0) return null
                      const pct = (ms / timingTotal) * 100
                      if (pct < 0.5) return null
                      return <div key={key} className="h-full shrink-0 hover:opacity-80 transition-opacity"
                                  style={{ width: `${pct}%`, backgroundColor: color }} title={`${key}: ${ms.toFixed(2)}ms`} />
                    })}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {TIMING_KEYS.map(({ key, label, color }) => {
                        const ms = (r.timings as any)[key] ?? 0
                        return (
                          <tr key={key} className="border-b border-[#f0ede8] last:border-b-0">
                            <td className="py-2 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-[12px] text-[#6b6b65] font-mono">{label}</span>
                            </td>
                            <td className="py-2 text-right">
                              <span className="text-[12px] text-[#1a1a18] font-mono tabular-nums">{ms.toFixed(2)} ms</span>
                            </td>
                            <td className="py-2 pl-3" style={{ width: '60%' }}>
                              <div className="h-1.5 bg-[#f5f3ef] rounded-full overflow-hidden border border-[#e4e1db]">
                                <div className="h-full rounded-full" style={{
                                  width: `${timingMax > 0 ? (ms / timingMax) * 100 : 0}%`,
                                  backgroundColor: color,
                                }} />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="border-t border-[#e4e1db]">
                        <td className="py-2"><span className="text-[12px] text-[#1a1a18] font-mono font-semibold">Total</span></td>
                        <td className="py-2 text-right">
                          <span className="text-[12px] text-[#1a1a18] font-mono font-semibold tabular-nums">{r.time.toFixed(2)} ms</span>
                        </td>
                        <td className="py-2 pl-3" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function Meta({ label, value, mono, children }: {
  label: string; value?: string; mono?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#8b8b82] text-[11px]">{label}</span>
      {children ?? <span className={`text-[#4a4a42] text-[11px] ${mono ? 'font-mono' : ''}`}>{value}</span>}
    </div>
  )
}

function Section({ title, count, subtitle, children }: {
  title: string; count?: number; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-[#1a1a18]">{title}</h3>
        {count !== undefined && <span className="text-[10px] text-[#8b8b82] font-mono">{count}</span>}
        {subtitle && <span className="text-[10px] text-[#8b8b82] font-mono">· {subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function CopyBtn({ onClick, copied }: { onClick: () => void; copied: boolean }) {
  return (
    <button onClick={onClick}
      className="px-2 py-0.5 text-[11px] rounded-md border border-[#e4e1db]
                 text-[#8b8b82] hover:bg-[#f5f3ef] hover:text-[#4a4a42] transition-colors">
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function DepthInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="inline-flex items-center gap-1 text-[10px] text-[#8b8b82] font-mono">
      depth
      <input type="number" min={1} max={10} value={value}
        onChange={e => { const v = Number(e.target.value); if (v >= 1 && v <= 10) onChange(v) }}
        className="w-10 px-1 py-0.5 text-[11px] text-center bg-white border border-[#e4e1db]
                   rounded text-[#1a1a18] outline-none focus:border-[#d4543c]/40"
      />
    </label>
  )
}
