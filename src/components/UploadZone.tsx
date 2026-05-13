import { useState, useRef, useCallback } from 'react'
import type { ParsedAPI } from '../types/har'

interface FileData { name: string; apis: ParsedAPI[] }

interface Props {
  onParse: (files: FileList | File[]) => void
  files: FileData[]
  onRemoveFile: (name: string) => void
  parsing: boolean
  error?: string
  onClearError?: () => void
  compact?: boolean
  fileFilter?: string[]
  onToggleFileFilter?: (name: string) => void
  cacheEnabled?: boolean
  onToggleCache?: (on: boolean) => void
}

export default function UploadZone({
  onParse, files, onRemoveFile, parsing,
  error: externalError, onClearError, compact,
  fileFilter, onToggleFileFilter,
  cacheEnabled, onToggleCache,
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const displayError = externalError || localError

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      setLocalError('')
      onClearError?.()
      const arr = Array.from(fileList)
      const invalid = arr.filter(f => !f.name.endsWith('.har') && f.type !== 'application/json')
      if (invalid.length === arr.length) { setLocalError('Please upload .har files'); return }
      onParse(arr)
    },
    [onParse, onClearError]
  )

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files)
  }, [processFiles])

  // ── Compact toolbar ──
  if (compact && files.length > 0) {
    return (
      <div className="px-4 py-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
          {files.map(f => {
            const active = !fileFilter || fileFilter.length === 0 || fileFilter.includes(f.name)
            return (
              <button
                key={f.name}
                onClick={() => onToggleFileFilter?.(f.name)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md
                  text-xs font-mono border transition-all cursor-pointer
                  ${active
                    ? 'border-[#d4543c]/40 bg-[#fef5f3] text-[#d4543c]'
                    : 'border-[#e4e1db] text-[#8b8b82] hover:border-[#c4c1b8] hover:text-[#4a4a42]'
                  }`}
              >
                <span className="max-w-[120px] truncate">{f.name}</span>
                <span className={`text-[10px] ${active ? 'text-[#d4543c]/70' : 'text-[#b8b5ae]'}`}>({f.apis.length})</span>
                <span
                  onClick={e => { e.stopPropagation(); onRemoveFile(f.name) }}
                  className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-sm cursor-pointer
                             text-[#b8b5ae] hover:text-[#c5221f] hover:bg-red-50 transition-colors"
                  role="button" tabIndex={0}
                >
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </span>
              </button>
            )
          })}
        </div>

        {parsing ? (
          <svg className="w-4 h-4 animate-spin text-[#b8b5ae] shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
            <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" opacity="0.7" />
          </svg>
        ) : (
          <>
            <input ref={inputRef} type="file" accept=".har,.json" multiple
              onChange={e => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = '' }}
              className="hidden" />
            <button
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`shrink-0 px-2.5 py-1 text-xs rounded-md font-mono border transition-all cursor-pointer
                ${dragOver
                  ? 'border-[#d4543c] bg-[#fef5f3] text-[#d4543c]'
                  : 'border-[#e4e1db] text-[#8b8b82] hover:border-[#c4c1b8] hover:text-[#4a4a42] hover:bg-[#f5f3ef]'
                }`}>
              + Add
            </button>
          </>
        )}
        {displayError && <p className="text-[11px] text-[#c5221f] shrink-0 font-mono">{displayError}</p>}
        {onToggleCache && (
          <label className="inline-flex items-center gap-1 text-[10px] text-[#8b8b82] font-mono cursor-pointer shrink-0"
                 title="Cache HAR files in browser for next visit">
            <input type="checkbox" checked={cacheEnabled ?? true}
              onChange={e => onToggleCache(e.target.checked)}
              className="w-3 h-3 accent-[#d4543c] cursor-pointer" />
            cache
          </label>
        )}
      </div>
    )
  }

  // ── Full upload hero ──
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-2xl p-16 cursor-pointer
          transition-all duration-200 text-center group
          ${dragOver
            ? 'border-[#d4543c] bg-[#fef5f3] scale-[1.01]'
            : 'border-[#d4d2cc] hover:border-[#b8b5ae] bg-white hover:bg-[#faf9f7]'
          }`}>
        <input ref={inputRef} type="file" accept=".har,.json" multiple
          onChange={e => { if (e.target.files?.length) processFiles(e.target.files) }}
          className="hidden" />

        <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors border
          ${dragOver ? 'bg-[#fef5f3] border-[#d4543c]/30' : 'bg-[#f5f3ef] border-[#e4e1db]'}`}>
          <svg className={`w-6 h-6 transition-colors ${dragOver ? 'text-[#d4543c]' : 'text-[#b8b5ae]'}`}
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <p className="text-[15px] font-medium text-[#1a1a18]">Drop HAR files here</p>
        <p className="text-[13px] text-[#8b8b82] mt-1 font-mono">or click to browse — multiple files supported</p>
        <p className="text-xs text-[#b8b5ae] mt-3">Export .har from DevTools Network panel</p>
      </button>

      {displayError && (
        <p className="text-sm text-[#c5221f] font-mono bg-red-50 px-4 py-2
                      rounded-lg border border-red-200 w-full text-center">{displayError}</p>
      )}
    </div>
  )
}
