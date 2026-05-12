import { useMemo, useState } from 'react'
import type { ParsedAPI } from '../types/har'
import type { SortMode } from '../lib/parser'
import { sortRequests } from '../lib/parser'
import Waterfall from './Waterfall'

interface Props {
  requests: ParsedAPI[]
  selectedId: string | null
  onSelect: (req: ParsedAPI) => void
  search: string
  onSearchChange: (v: string) => void
  sortMode: SortMode
  onSortMode: (m: SortMode) => void
  fileFilter: string[]
  searchFields: string[]
  onSearchFieldsChange: (fields: string[]) => void
}

const SEARCH_FIELDS = [
  { key: 'url', label: 'URL' },
  { key: 'host', label: 'Host' },
  { key: 'method', label: 'Method' },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Type' },
  { key: 'initiator', label: 'Initiator' },
  { key: 'body', label: 'Body' },
] as const

const METHOD_COLOR: Record<string, string> = {
  GET:    'text-[#137333] border-[#a8d8b9] bg-[#e6f4ea]',
  POST:   'text-[#1967d2] border-[#a8c8fa] bg-[#e8f0fe]',
  PUT:    'text-[#b06000] border-[#f0c960] bg-[#fef7e0]',
  PATCH:  'text-[#e37400] border-[#f0b870] bg-[#fff3e0]',
  DELETE: 'text-[#c5221f] border-[#f0a8a8] bg-[#fce8e6]',
}

const STATUS_COLOR: Record<string, string> = {
  '2': 'text-[#137333] border-[#a8d8b9] bg-[#e6f4ea]',
  '3': 'text-[#1967d2] border-[#a8c8fa] bg-[#e8f0fe]',
  '4': 'text-[#b06000] border-[#f0c960] bg-[#fef7e0]',
  '5': 'text-[#c5221f] border-[#f0a8a8] bg-[#fce8e6]',
}

function searchText(r: ParsedAPI, fields: string[]): string {
  const parts: string[] = []
  if (fields.includes('url'))       parts.push(r.pathname, r.fullUrl)
  if (fields.includes('host'))      parts.push(r.host)
  if (fields.includes('method'))    parts.push(r.method)
  if (fields.includes('status'))    parts.push(String(r.status), r.statusText)
  if (fields.includes('type'))      parts.push(r.responseType)
  if (fields.includes('initiator')) parts.push(r.initiatorType, r.initiatorUrl)
  if (fields.includes('body')) {
    if (r.requestBody) parts.push(JSON.stringify(r.requestBody))
    if (r.responseBody) parts.push(JSON.stringify(r.responseBody))
  }
  return parts.join(' ').toLowerCase()
}

function shortType(mime: string): string {
  if (!mime) return '—'
  if (mime.includes('json')) return 'json'
  if (mime.includes('html')) return 'html'
  if (mime.includes('javascript')) return 'js'
  if (mime.includes('css')) return 'css'
  if (mime.includes('image/svg')) return 'svg'
  if (mime.includes('image')) return 'img'
  if (mime.includes('font') || mime.includes('woff')) return 'font'
  if (mime.includes('form-urlencoded')) return 'form'
  if (mime.includes('octet-stream')) return 'bin'
  if (mime.includes('text/plain')) return 'text'
  const parts = mime.split('/')
  return parts[1] ?? mime
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0')
  } catch { return iso }
}

export default function RequestTable({
  requests, selectedId, onSelect, search, onSearchChange, sortMode, onSortMode,
  fileFilter, searchFields, onSearchFieldsChange,
}: Props) {
  const lower = search.toLowerCase()

  const filtered = useMemo(() => {
    let list = requests
    if (fileFilter.length > 0) list = list.filter(r => fileFilter.includes(r.sourceFile))
    if (lower) list = list.filter(r => searchText(r, searchFields).includes(lower))
    return sortRequests(list, sortMode)
  }, [requests, lower, sortMode, fileFilter, searchFields])

  const maxTime = useMemo(
    () => Math.max(...filtered.map((r) => r.time), 1),
    [filtered]
  )

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search bar */}
      <div className="px-4 pt-3 pb-2 shrink-0 flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b8b5ae]"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Filter..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-[13px] bg-[#f5f3ef] border border-transparent
                       rounded-lg text-[#1a1a18] placeholder-[#b8b5ae] font-mono
                       focus:bg-white focus:border-[#d4543c]/40 focus:ring-1 focus:ring-[#d4543c]/15
                       transition-all outline-none"
          />
          {search && (
            <button onClick={() => onSearchChange('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5
                         flex items-center justify-center rounded text-[#b8b5ae]
                         hover:text-[#4a4a42] hover:bg-[#e4e1db] transition-colors">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search fields filter */}
        <SearchFieldsDropdown
          fields={SEARCH_FIELDS.map(f => f.key)}
          labels={Object.fromEntries(SEARCH_FIELDS.map(f => [f.key, f.label]))}
          selected={searchFields}
          onChange={onSearchFieldsChange}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <colgroup>
            <col style={{ width: 58 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 'auto' }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 88 }} />
            <col style={{ minWidth: 200 }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[#e4e1db] bg-[#faf9f7]">
              <Th>Method</Th>
              <Th center>Status</Th>
              <Th>Path</Th>
              <Th>Initiator</Th>
              <Th center>Type</Th>
              <Th right>
                <button
                  onClick={() => onSortMode(sortMode === 'duration' ? 'startTime' : 'duration')}
                  className="flex items-center gap-1 hover:text-[#1a1a18] transition-colors"
                >
                  {sortMode === 'startTime' ? 'Time' : 'Dur'}
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
                  </svg>
                </button>
              </Th>
              <Th>Waterfall</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center text-sm text-[#b8b5ae]">
                  {requests.length === 0 ? 'Drop a HAR file to begin' : 'No matching requests'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const sel = selectedId === r.id
                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelect(r)}
                    className={`border-b border-[#f0ede8] cursor-pointer transition-colors
                      ${sel
                        ? 'bg-[#fef5f3] border-l-2 border-l-[#d4543c]'
                        : 'border-l-2 border-l-transparent hover:bg-[#faf9f7]'
                      }`}
                  >
                    {/* Method */}
                    <td className="pl-3 pr-0 py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border
                        ${METHOD_COLOR[r.method] ?? 'text-[#6b6b65] border-[#c4c1b8] bg-[#f5f3ef]'}`}>
                        {r.method}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-0 py-1.5 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border
                        ${STATUS_COLOR[String(r.status)[0]] ?? 'text-[#6b6b65] border-[#c4c1b8] bg-[#f5f3ef]'}`}>
                        {r.status}
                      </span>
                    </td>

                    {/* Path — full, one line, no truncation */}
                    <td className="px-2 py-1">
                      <div className="flex flex-col">
                        <span className="text-[13px] text-[#1a1a18] font-mono leading-snug whitespace-nowrap">
                          {r.pathname}
                        </span>
                        <span className="text-[10px] text-[#8b8b82] font-mono leading-snug truncate" title={r.host}>
                          {r.host}
                        </span>
                      </div>
                    </td>

                    {/* Initiator */}
                    <td className="px-1 py-1.5">
                      <span className="text-[11px] text-[#6b6b65] font-mono truncate block max-w-[100px]"
                            title={r.initiatorType || r.initiatorUrl || r.pageTitle}>
                        {r.initiatorType || r.pageTitle || '—'}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-0 py-1.5 text-center">
                      <span className="text-[10px] text-[#6b6b65] font-mono
                                       bg-[#f5f3ef] px-1.5 py-0.5 rounded border border-[#e4e1db]">
                        {shortType(r.responseType)}
                      </span>
                    </td>

                    {/* Time */}
                    <td className="px-1 py-1.5 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] text-[#4a4a42] font-mono tabular-nums">
                          {sortMode === 'startTime' ? formatTime(r.startedDateTime) : `${r.time.toFixed(2)}ms`}
                        </span>
                        <span className="text-[10px] text-[#8b8b82] font-mono tabular-nums">
                          {sortMode === 'startTime' ? `${r.time.toFixed(2)}ms` : formatTime(r.startedDateTime)}
                        </span>
                      </div>
                    </td>

                    {/* Waterfall */}
                    <td className="pl-2 pr-3 py-1.5">
                      <Waterfall timings={r.timings} totalTime={r.time} maxTime={maxTime} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-[#e4e1db] text-[10px] text-[#8b8b82] font-mono
                      flex items-center justify-between shrink-0">
        <span>
          {filtered.length} of {requests.length} request{requests.length !== 1 ? 's' : ''}
          {filtered.length !== requests.length && ' shown'}
        </span>
        <span>Sorted {sortMode === 'startTime' ? 'by time' : 'by duration'}</span>
      </div>
    </div>
  )
}

function SearchFieldsDropdown({ fields, labels, selected, onChange }: {
  fields: string[]; labels: Record<string, string>; selected: string[]; onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = selected.length
  const allSelected = activeCount === fields.length

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      if (selected.length > 1) onChange(selected.filter(s => s !== key))
    } else {
      onChange([...selected, key])
    }
  }

  const toggleAll = () => {
    onChange(allSelected ? [fields[0]] : [...fields])
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg font-mono border transition-colors
          ${allSelected
            ? 'border-[#e4e1db] text-[#8b8b82] hover:border-[#c4c1b8]'
            : 'border-[#d4543c]/30 text-[#d4543c] bg-[#fef5f3]'
          }`}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        {allSelected ? 'All' : `${activeCount}/${fields.length}`}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-[#e4e1db]
                          rounded-lg shadow-lg py-1 min-w-[150px]">
            <button
              onClick={toggleAll}
              className="w-full text-left px-3 py-1.5 text-[11px] text-[#8b8b82] font-mono
                         hover:bg-[#f5f3ef] border-b border-[#f0ede8]"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {fields.map(key => {
              const checked = selected.includes(key)
              return (
                <button key={key} onClick={() => toggle(key)}
                  className={`w-full flex items-center gap-2 px-3 py-1 text-[12px] font-mono
                    hover:bg-[#f5f3ef] transition-colors
                    ${checked ? 'text-[#1a1a18]' : 'text-[#b8b5ae]'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0
                    ${checked ? 'bg-[#d4543c] border-[#d4543c]' : 'border-[#c4c1b8]'}`}
                  >
                    {checked && (
                      <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  {labels[key]}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Th({ children, center, right }: { children: React.ReactNode; center?: boolean; right?: boolean }) {
  return (
    <th className={`px-1 py-2 text-[10px] font-semibold text-[#8b8b82] uppercase tracking-wider
      ${center ? 'text-center' : ''} ${right ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}
