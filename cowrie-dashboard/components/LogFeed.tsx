export default function LogFeed({ lines }: { lines: string[] }) {
  return (
    <div>
      <p className="mono text-xs text-dim uppercase tracking-wider mb-4">Raw Log Feed (last 50 lines)</p>
      <div className="bg-surface border border-border rounded p-4 space-y-0.5 max-h-[600px] overflow-y-auto">
        {lines.map((line, i) => {
          const isError   = line.includes('ERROR') || line.includes('error')
          const isLogin   = line.includes('login attempt')
          const isCmd     = line.includes('CMD:')
          const isConnect = line.includes('New connection')

          let color = 'text-dim'
          if (isError)   color = 'text-red'
          else if (isLogin)   color = 'text-amber'
          else if (isCmd)     color = 'text-blue'
          else if (isConnect) color = 'text-green'

          return (
            <p key={i} className={`mono text-xs ${color} leading-5 break-all`}>
              {line}
            </p>
          )
        })}
        {lines.length === 0 && <p className="mono text-xs text-dim">no log data</p>}
      </div>
    </div>
  )
}
