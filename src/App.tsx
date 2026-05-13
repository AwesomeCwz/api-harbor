import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ParsedAPI } from './types/har'
import type { SortMode } from './lib/parser'
import { parseHAR } from './lib/parser'
import UploadZone from './components/UploadZone'
import RequestTable from './components/RequestTable'
import RequestDrawer from './components/RequestDrawer'

const DB_NAME = 'api-harbor'
const STORE_NAME = 'files'

interface CacheEntry { name: string; text: string }

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME, { keyPath: 'name' }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadCache(): Promise<CacheEntry[]> {
  try {
    const db = await openDB()
    return new Promise(resolve => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      req.onsuccess = () => { db.close(); resolve(req.result) }
      req.onerror = () => { db.close(); resolve([]) }
    })
  } catch { return [] }
}

async function saveCache(entries: CacheEntry[]) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.clear()
    for (const e of entries) store.put(e)
    db.close()
  } catch {}
}

async function clearCache() {
  try {
    const db = await openDB()
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear()
    db.close()
  } catch {}
}

interface FileData {
  name: string
  apis: ParsedAPI[]
}

export default function App() {
  const [files, setFiles] = useState<FileData[]>([])
  const [selected, setSelected] = useState<ParsedAPI | null>(null)
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('startTime')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [fileFilter, setFileFilter] = useState<string[]>([])
  const [searchFields, setSearchFields] = useState<string[]>(['url','host','method','status','type','initiator','body'])
  const [methodFilter, setMethodFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [cacheLoaded, setCacheLoaded] = useState(false)

  // Load cached files on mount
  useEffect(() => {
    (async () => {
      const cached = await loadCache()
      if (cached.length === 0) { setCacheLoaded(true); return }
      const results: FileData[] = []
      for (const { name, text } of cached) {
        try { results.push({ name, apis: parseHAR(text, name) }) } catch {}
      }
      if (results.length > 0) setFiles(results)
      setCacheLoaded(true)
    })()
  }, [])

  const requests = useMemo(
    () => files.flatMap((f) => f.apis),
    [files]
  )

  const handleAddFiles = useCallback(async (fileList: FileList | File[]) => {
    setParsing(true)
    setParseError('')
    const results: FileData[] = []
    const errors: string[] = []
    const cacheEntries: CacheEntry[] = []

    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text()
        results.push({ name: file.name, apis: parseHAR(text, file.name) })
        cacheEntries.push({ name: file.name, text })
      } catch (err) {
        errors.push(file.name)
        console.error(`Failed to parse ${file.name}:`, err)
      }
    }

    if (errors.length > 0) setParseError(`Failed: ${errors.join(', ')}`)
    setFiles((prev) => {
      const next = [...prev, ...results]
      // Async: merge with existing cache
      ;(async () => {
        const existing = (await loadCache()).filter(c => !cacheEntries.some(e => e.name === c.name))
        await saveCache([...existing, ...cacheEntries])
      })()
      return next
    })
    setParsing(false)
  }, [])

  const handleRemoveFile = useCallback((name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name))
    setFileFilter((prev) => prev.filter(f => f !== name))
    setSelected(null)
    ;(async () => {
      const cached = (await loadCache()).filter(c => c.name !== name)
      if (cached.length > 0) await saveCache(cached)
      else await clearCache()
    })()
  }, [])

  const toggleFileFilter = useCallback((name: string) => {
    setFileFilter(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    )
  }, [])

  const handleReset = useCallback(() => {
    setFiles([])
    setSelected(null)
    setSearch('')
    setParseError('')
    setFileFilter([])
    clearCache()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[#f9f8f6] text-[#1a1a18]">
      {/* Header */}
      <header className="h-11 shrink-0 border-b border-[#e4e1db] flex items-center px-5 bg-white gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4 text-[#d4543c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <h1 className="text-[13px] font-semibold tracking-tight">API Harbor</h1>
        </div>

        {files.length > 0 && (
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-[#8b8b82] font-mono">
              {requests.length} request{requests.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleReset}
              className="px-2.5 py-1 text-[11px] rounded-md font-mono cursor-pointer
                         border border-[#e4e1db] text-[#8b8b82]
                         hover:border-[#c4c1b8] hover:text-[#4a4a42] hover:bg-[#f5f3ef]
                         transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </header>

      {/* Upload or Results */}
      {files.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            {(parsing || !cacheLoaded) ? (
              <div className="flex flex-col items-center gap-3 text-[#8b8b82]">
                <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                  <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" opacity="0.7" />
                </svg>
                <span className="text-sm font-mono">Loading...</span>
              </div>
            ) : (
              <UploadZone
                onParse={handleAddFiles}
                files={files}
                onRemoveFile={handleRemoveFile}
                parsing={parsing}
                error={parseError}
                onClearError={() => setParseError('')}
                fileFilter={fileFilter}
                onToggleFileFilter={toggleFileFilter}
              />
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="border-b border-[#e4e1db] bg-white">
            <UploadZone
              onParse={handleAddFiles}
              files={files}
              onRemoveFile={handleRemoveFile}
              parsing={parsing}
              error={parseError}
              onClearError={() => setParseError('')}
              compact
              fileFilter={fileFilter}
              onToggleFileFilter={toggleFileFilter}
            />
          </div>

          {/* Full-width table */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <RequestTable
              requests={requests}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              search={search}
              onSearchChange={setSearch}
              sortMode={sortMode}
              onSortMode={setSortMode}
              fileFilter={fileFilter}
              searchFields={searchFields}
              onSearchFieldsChange={setSearchFields}
              methodFilter={methodFilter}
              onMethodFilterChange={setMethodFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
          </div>
        </>
      )}

      {/* Drawer */}
      {selected && (
        <RequestDrawer
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
