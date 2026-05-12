import { useState, useCallback } from 'react'

interface Props { data: unknown; highlightPath?: string[] }

export default function JsonViewer({ data, highlightPath }: Props) {
  if (data === undefined) {
    return <div className="text-[#b8b5ae] text-sm italic py-4">No data</div>
  }
  return (
    <pre className="bg-[#f5f3ef] text-[13px] leading-relaxed p-4 rounded-lg border border-[#e4e1db]
                    overflow-auto font-mono text-[#1a1a18] select-text">
      <JsonNode value={data} depth={0} keyName="" path={[]} highlightPath={highlightPath ?? []} />
    </pre>
  )
}

function matchesHighlight(nodePath: (string | number)[], highlightPath: string[]): boolean {
  const keys = nodePath.filter(p => typeof p === 'string') as string[]
  if (keys.length !== highlightPath.length) return false
  return keys.every((k, i) => k === highlightPath[i])
}

function JsonNode({ value, depth, keyName, path, highlightPath }: {
  value: unknown; depth: number; keyName: string; path: (string | number)[]; highlightPath: string[]
}) {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = useCallback(() => setCollapsed(v => !v), [])

  const pad = '  '.repeat(depth)
  const nodePath = keyName ? [...path, keyName] : path
  const hl = highlightPath.length > 0 && matchesHighlight(nodePath, highlightPath)

  const keyPart = keyName ? <span className="text-[#d4543c]">{JSON.stringify(keyName)}</span> : null
  const colon = keyName ? <span className="text-[#8b8b82]">: </span> : null

  const baseCls = hl ? 'bg-[#fde8e4] rounded' : ''

  if (value === null) {
    return <div className={baseCls}>{pad}{keyPart}{colon}<span className="text-[#b8b5ae] italic">null</span></div>
  }

  if (typeof value === 'boolean') {
    return <div className={baseCls}>{pad}{keyPart}{colon}<span className="text-[#b06000]">{String(value)}</span></div>
  }

  if (typeof value === 'number') {
    return <div className={baseCls}>{pad}{keyPart}{colon}<span className="text-[#1967d2]">{value}</span></div>
  }

  if (typeof value === 'string') {
    return <div className={baseCls}>{pad}{keyPart}{colon}<span className="text-[#137333]">{JSON.stringify(value)}</span></div>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <div className={baseCls}>{pad}{keyPart}{colon}<span className="text-[#8b8b82]">[]</span></div>
    }
    const bracket = collapsed ? (
      <span className="text-[#8b8b82]">[...{value.length} items]</span>
    ) : (
      <span className="text-[#8b8b82]">[</span>
    )
    return (
      <div className={baseCls}>
        <div onClick={toggle} className="cursor-pointer hover:bg-[#edeae4] rounded select-none">
          {pad}{keyPart}{colon}{bracket}
          {collapsed && <span className="text-[#b8b5ae] ml-1 text-[11px]">▶</span>}
        </div>
        {!collapsed && (
          <>
            {value.map((item, i) => (
              <JsonNode key={i} value={item} depth={depth + 1} keyName=""
                path={nodePath} highlightPath={highlightPath} />
            ))}
            <div>{pad}<span className="text-[#8b8b82]">]</span></div>
          </>
        )}
      </div>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return <div className={baseCls}>{pad}{keyPart}{colon}<span className="text-[#8b8b82]">{'{}'}</span></div>
    }
    const brace = collapsed ? (
      <span className="text-[#8b8b82]">{'{...'}{entries.length} keys{'}'}</span>
    ) : (
      <span className="text-[#8b8b82]">{'{'}</span>
    )
    return (
      <div className={baseCls}>
        <div onClick={toggle} className="cursor-pointer hover:bg-[#edeae4] rounded select-none">
          {pad}{keyPart}{colon}{brace}
          {collapsed && <span className="text-[#b8b5ae] ml-1 text-[11px]">▶</span>}
        </div>
        {!collapsed && (
          <>
            {entries.map(([k, v]) => (
              <JsonNode key={k} value={v} depth={depth + 1} keyName={k}
                path={nodePath} highlightPath={highlightPath} />
            ))}
            <div>{pad}<span className="text-[#8b8b82]">{'}'}</span></div>
          </>
        )}
      </div>
    )
  }

  return <div className={baseCls}>{pad}{keyPart}{colon}<span>{String(value)}</span></div>
}
