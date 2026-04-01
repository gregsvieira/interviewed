interface LiveTranscriptProps {
  text: string
  isActive: boolean
}

export function LiveTranscript({ text, isActive }: LiveTranscriptProps) {
  if (!isActive && !text) {
    return null
  }

  return (
    <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Live Transcript
        </span>
      </div>
      <div className="min-h-[2.5rem] text-zinc-200 text-base leading-relaxed">
        {text || (
          <span className="text-zinc-500 italic">Listening...</span>
        )}
        {isActive && text && (
          <span className="animate-pulse text-zinc-400">|</span>
        )}
      </div>
    </div>
  )
}
