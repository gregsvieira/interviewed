import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { WS_URL } from '@/lib/utils'
import { WebSpeechSTT } from '@/services/audio/webSpeech.stt'
import { WebSpeechTTS } from '@/services/audio/webSpeech.tts'
import { useAuthStore } from '@/stores/auth.store'
import { useInterviewStore } from '@/stores/interview.store'
import { ChevronDown, ChevronUp, Clock, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { ConversationLog } from './ConversationLog'
import { SpeakingCircle } from './SpeakingCircle'

export function InterviewRoom() {
  const navigate = useNavigate()
  const { selectedTopic, selectedSubtopic, selectedLevel, isAiSpeaking, isUserSpeaking, conversationLog, timeRemaining, addMessage, setAiSpeaking, setUserSpeaking, decrementTime, startInterview, endInterview, preloadedMessage, setPreloadedMessage, interviewerGender } = useInterviewStore()
  const { token, user } = useAuthStore()

  const [socket, setSocket] = useState<Socket | null>(null)
  const [sttService] = useState(() => new WebSpeechSTT())
  const [ttsService] = useState(() => new WebSpeechTTS())
  const [typingMessage, setTypingMessage] = useState<{ role: 'ai' | 'user'; text: string } | null>(null)
  const [userSpeakingText, setUserSpeakingText] = useState('')
  const [showConversation, setShowConversation] = useState(true)
  const [interviewStarted, setInterviewStarted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [sttError, setSttError] = useState<string | null>(null)
  const [manualText, setManualText] = useState('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const preloadedUsedRef = useRef(false)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const accumulatedTextRef = useRef('')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const newSocket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    })

    newSocket.on('connect', () => {
      if (!interviewStarted && !preloadedMessage) {
        newSocket.emit('start', {
          topic: selectedTopic?.name,
          subtopic: selectedSubtopic?.name,
          level: selectedLevel,
          duration: 30,
          candidateName: user?.name || 'Candidate',
        })
        startInterview()
        setInterviewStarted(true)
      }
    })

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
    })

    newSocket.on('ai:text', (data: { text: string }) => {
      if (!preloadedUsedRef.current) {
        setTypingMessage({ role: 'ai', text: data.text })
      }
    })

    newSocket.on('ai:speaking', (speaking: boolean) => {
      setAiSpeaking(speaking)
    })

    newSocket.on('interview:ended', () => {
      endInterview()
      navigate('/history')
    })

    newSocket.on('disconnect', () => {
      endInterview()
    })

    setSocket(newSocket)
    ttsService.onSpeakingChange(setAiSpeaking)

    return () => {
      newSocket.disconnect()
      ttsService.stop()
    }
  }, [token, selectedTopic, selectedSubtopic])

  useEffect(() => {
    sttService.onInterimResult((text) => {
      console.log('[InterviewRoom] Interim result:', text);
      setUserSpeakingText(accumulatedTextRef.current ? accumulatedTextRef.current + ' ' + text : text)
    })

    sttService.onResult((text) => {
      console.log('[InterviewRoom] Final result:', text);
      accumulatedTextRef.current = accumulatedTextRef.current 
        ? accumulatedTextRef.current + ' ' + text 
        : text
      setUserSpeakingText(accumulatedTextRef.current.trim())
    })

    sttService.onSpeakingChange((speaking) => {
      console.log('[InterviewRoom] Speaking changed:', speaking);
      setUserSpeaking(speaking)
    })
  }, [])

  useEffect(() => {
    console.log('[InterviewRoom] preloadedMessage effect:', { preloadedMessage, preloadedUsed: preloadedUsedRef.current, interviewStarted })
    if (preloadedMessage && !preloadedUsedRef.current && interviewStarted === false) {
      preloadedUsedRef.current = true
      setInterviewStarted(true)
      startInterview()
      console.log('[InterviewRoom] Setting typing message:', preloadedMessage.text.substring(0, 50) + '...')
      setTypingMessage({ role: 'ai', text: preloadedMessage.text })
    }
  }, [preloadedMessage])

  useEffect(() => {
    console.log('[InterviewRoom] typingMessage effect:', { typingMessage, interviewerGender })
    if (typingMessage) {
      if (typingMessage.role === 'ai') {
        console.log('[InterviewRoom] Starting TTS with gender:', interviewerGender)
        setAiSpeaking(true)
        ttsService.speak(typingMessage.text, interviewerGender).catch((err) => {
          console.log('[InterviewRoom] TTS error:', err)
          setAiSpeaking(false)
        })

        const timeout = setTimeout(() => {
          console.log('[InterviewRoom] Adding message to log')
          addMessage({ role: 'ai', text: typingMessage.text })
          setTypingMessage(null)
        }, 500)
        return () => clearTimeout(timeout)
      } else {
        setTypingMessage(null)
      }
    }
  }, [typingMessage])

  useEffect(() => {
    if (timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        decrementTime()
      }, 1000)
    } else {
      socket?.emit('end')
      navigate('/history')
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [timeRemaining])

  useEffect(() => {
    if (!isRecording) return

    const resetSilenceTimeout = () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      silenceTimeoutRef.current = setTimeout(() => {
        sttService.stop()
        setIsRecording(false)
      }, 2000)
    }

    const interval = setInterval(resetSilenceTimeout, 500)

    return () => {
      clearInterval(interval)
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
    }
  }, [isRecording])

  const handleMicPress = async () => {
    console.log('[InterviewRoom] Mic pressed');
    setSttError(null)
    accumulatedTextRef.current = ''
    setUserSpeakingText('')
    setIsRecording(true)
    setManualText('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[InterviewRoom] Microphone permission granted');
    } catch (err) {
      console.error('[InterviewRoom] Microphone permission denied:', err);
      setSttError('Microphone permission denied. Please allow microphone access and try again.')
      setUserSpeaking(false)
      setIsRecording(false)
      return
    }

    try {
      await sttService.start()
      console.log('[InterviewRoom] STT started');
    } catch (err) {
      console.error('[InterviewRoom] STT start error:', err)
      setSttError('Voice recognition not available. Please use manual input below.')
      setUserSpeaking(false)
      setIsRecording(false)
    }
  }

  const handleManualSubmit = () => {
    const text = manualText.trim()
    if (text) {
      addMessage({ role: 'user', text })
      socket?.emit('user:text', { text })
    }
    setManualText('')
    setSttError(null)
  }

  const handleMicRelease = () => {
    console.log('[InterviewRoom] Mic released');
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    sttService.stop()
    setUserSpeaking(false)

    const finalText = accumulatedTextRef.current.trim()
    console.log('[InterviewRoom] Final text:', finalText);
    accumulatedTextRef.current = ''
    setUserSpeakingText('')
    setIsRecording(false)

    if (finalText) {
      addMessage({ role: 'user', text: finalText })
      socket?.emit('user:text', { text: finalText })
    }
  }

  const handleEndInterview = () => {
    socket?.emit('end')
    ttsService.stop()
    setPreloadedMessage(null)
    endInterview()
    navigate('/history')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col h-screen overflow-hidden">
      <header className="p-2 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-zinc-300 text-sm font-medium">
            {selectedTopic?.name} - {selectedSubtopic?.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Clock className="w-4 h-4" />
          <span className={timeRemaining < 60 ? 'text-red-400' : ''}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-between py-4 px-4 min-h-0">
        <div className="flex items-center justify-center flex-1">
          <SpeakingCircle label="AI" isSpeaking={isAiSpeaking} size="md" />
        </div>

        {isUserSpeaking && userSpeakingText && (
          <div className="max-w-[85%] rounded-2xl px-5 py-4 text-base leading-relaxed bg-blue-600 text-white self-center mb-4 animate-pulse">
            {userSpeakingText}
          </div>
        )}

        <div className="flex items-center justify-center flex-1">
          <SpeakingCircle
            label="You"
            isSpeaking={isUserSpeaking}
            isRecording={isRecording}
            size="md"
            isUserCircle
            showMicButton
            onMicPress={handleMicPress}
            onMicRelease={handleMicRelease}
          />
        </div>

        {(sttError || manualText) && (
          <div className="w-full max-w-md mx-auto mb-4 space-y-2">
            {sttError && (
              <p className="text-red-400 text-sm text-center">{sttError}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Type your answer here..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
              <Button onClick={handleManualSubmit} disabled={!manualText.trim()}>
                Send
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 shrink-0">
        <button
          onClick={() => setShowConversation(!showConversation)}
          className="w-full p-2 flex items-center justify-center gap-2 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >
          <span className="text-sm">Conversation</span>
          {showConversation ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {showConversation && (
          <div className="h-40 overflow-y-auto">
            <ConversationLog messages={conversationLog} typingMessage={typingMessage} />
          </div>
        )}
      </div>

      <footer className="p-2 border-t border-zinc-800 shrink-0">
        <Button
          variant="destructive"
          className="w-full text-sm"
          onClick={handleEndInterview}
        >
          <Square className="w-4 h-4 mr-2" />
          End Interview
        </Button>
      </footer>
    </div>
  )
}
