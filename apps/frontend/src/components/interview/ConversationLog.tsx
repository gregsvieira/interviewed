import { Message } from '@/types/interview'
import { useEffect, useState } from 'react'

interface ConversationLogProps {
  messages: Message[]
  typingMessage?: { role: 'ai' | 'user'; text: string } | null
  userLiveText?: string
}

export function ConversationLog({ messages, typingMessage, userLiveText }: ConversationLogProps) {
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    if (!typingMessage) {
      setDisplayedText('')
      return
    }

    setDisplayedText('')

    const text = typingMessage.text
    let index = 0
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 20)

    return () => clearInterval(interval)
  }, [typingMessage?.text])

  return (
    <div className="h-64 border-t border-zinc-800 p-4 overflow-y-auto space-y-6">
      {messages.length === 0 && !typingMessage ? (
        <p className="text-zinc-500 text-center text-base py-8">The conversation will appear here...</p>
      ) : (
        <>
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.role === 'ai' ? 'items-start' : 'items-end'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {msg.role === 'ai' ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">AI</div>
                    <span className="text-xs font-medium text-blue-400">Interviewer</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-medium text-zinc-400">You</span>
                    <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-white text-xs font-bold">V</div>
                  </>
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-4 text-base leading-relaxed ${
                  msg.role === 'ai'
                    ? 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                    : 'bg-blue-600 text-white rounded-tr-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {typingMessage && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">AI</div>
                <span className="text-xs font-medium text-blue-400">Interviewer</span>
              </div>
              <div className="max-w-[85%] rounded-2xl px-5 py-4 text-base leading-relaxed bg-zinc-800 text-zinc-200 rounded-tl-sm">
                {displayedText}
                <span className="animate-pulse">|</span>
              </div>
            </div>
          )}

          {userLiveText && (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-2 flex-row-reverse">
                <span className="text-xs font-medium text-zinc-400">You</span>
                <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-white text-xs font-bold">V</div>
              </div>
              <div className="max-w-[85%] rounded-2xl px-5 py-4 text-base leading-relaxed bg-blue-600 text-white rounded-tr-sm">
                {userLiveText}
                <span className="animate-pulse">|</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
