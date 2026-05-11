import { Button } from '@/components/ui/button'
import { profileApi } from '@/services/api/profile.api'
import { MediaRecorderService } from '@/services/audio/mediaRecorder.stt'
import { WebSpeechSTT } from '@/services/audio/webSpeech.stt'
import { WebSpeechTTS } from '@/services/audio/webSpeech.tts'
import { disconnectInterview, startInterview as startInterviewGateway } from '@/services/websocket/interview.gateway'
import { getSocket } from '@/services/websocket/socket'
import { useAuthStore } from '@/stores/auth.store'
import { useInterviewStore } from '@/stores/interview.store'
import { ChevronDown, ChevronUp, Clock, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Socket } from 'socket.io-client'
import { ConversationLog } from './ConversationLog'
import { LiveTranscript } from './LiveTranscript'
import { SpeakingCircle } from './SpeakingCircle'

export function InterviewRoom() {
  const navigate = useNavigate()
  const { selectedTopic, selectedSubtopic, selectedLevel, isAiSpeaking, isUserSpeaking, conversationLog, timeRemaining, addMessage, updateMessage, setAiSpeaking, setUserSpeaking, decrementTime, startInterview, endInterview, preloadedMessage, setPreloadedMessage, interviewerGender, interviewerName, interviewerAvatar, setInterviewerAvatar, preloadedInterviewId, setPreloadedInterviewId } = useInterviewStore()
  const { token, user } = useAuthStore()

  const [sttService] = useState(() => new MediaRecorderService())
  const [webSpeechService] = useState(() => new WebSpeechSTT())
  const [ttsService] = useState(() => new WebSpeechTTS())
  const [typingMessage, setTypingMessage] = useState<{ role: 'ai' | 'user'; text: string } | null>(null)
  const [userSpeakingText, setUserSpeakingText] = useState('')
  const [userLiveText, setUserLiveText] = useState('')
  const [liveTranscriptActive, setLiveTranscriptActive] = useState(false)
  const [showConversation, setShowConversation] = useState(true)
  const [interviewStarted, setInterviewStarted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [sttError, setSttError] = useState<string | null>(null)
  const [manualText, setManualText] = useState('')
  const [userAvatar, setUserAvatar] = useState<string | undefined>(undefined)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const preloadedUsedRef = useRef(false)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const accumulatedTextRef = useRef('')
  const socketRef = useRef<Socket | null>(null)
  const interviewIdRef = useRef<string | null>(null)
  const webSpeechFinalTextRef = useRef('')
  const webSpeechSentRef = useRef(false)
  const currentUserMessageIdRef = useRef<string | null>(null)
  const sttServiceStartedRef = useRef(false)
  const sttStartPromiseRef = useRef<Promise<void> | null>(null)
  const interviewStartedRef = useRef(false)

  useEffect(() => {
    profileApi.getProfile().then((profile) => {
      setUserAvatar(profile.avatar)
    }).catch(() => {
      // Profile not found, use default
    })
  }, [])

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const storedInterviewId = localStorage.getItem('preloadedInterviewId')
    const storedMessage = localStorage.getItem('preloadedMessage')
    console.log('[InterviewRoom] Mounted, checking localStorage:');
    console.log('[InterviewRoom]   storedInterviewId:', storedInterviewId);
    console.log('[InterviewRoom]   storedMessage:', storedMessage ? 'exists' : 'null');
    console.log('[InterviewRoom]   preloadedInterviewId (store):', preloadedInterviewId);
    console.log('[InterviewRoom]   preloadedMessage (store):', preloadedMessage ? 'exists' : 'null');
    
    const effectiveInterviewId = storedInterviewId || preloadedInterviewId
    const effectivePreloadedMessage = storedMessage ? JSON.parse(storedMessage) : preloadedMessage
    
    const socket = getSocket(token)
    socket.off('connect')
    socket.off('interview:started')
    socket.off('ai:text')
    socket.off('ai:speaking')
    socket.off('whisper:result')
    socket.off('interview:ended')
    socket.off('disconnect')
    socket.off('connect_error')
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[InterviewRoom] Socket connected!')
      console.log('[InterviewRoom] Socket ID:', socket.id)

      if (effectiveInterviewId) {
        console.log('[InterviewRoom] Reusing preloaded interview')
      
        interviewIdRef.current = effectiveInterviewId
      
        socket.emit('interview:resume', {
          interviewId: effectiveInterviewId,
        })
      
        startInterview()
        setInterviewStarted(true)
      
        return
      }

      if (!interviewStartedRef.current) {
        console.log('[InterviewRoom] No preload, emitting start...')
      
        startInterviewGateway(token!, {
          topic: selectedTopic?.name,
          subtopic: selectedSubtopic?.name,
          level: selectedLevel,
          duration: 30,
          candidateName: user?.name || 'Candidate',
        })
      
        startInterview()
        setInterviewStarted(true)
        interviewStartedRef.current = true
      }
    })

    socket.on('interview:started', (data) => {
      const storedId = localStorage.getItem('preloadedInterviewId')
    
      if (!effectiveInterviewId && !storedId) {
        console.log('[InterviewRoom] Setting interviewId from backend')
        interviewIdRef.current = data.interviewId
      }
    
      if (data.interviewerAvatar) {
        setInterviewerAvatar(data.interviewerAvatar)
      }
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
    })

    socket.on('ai:text', (data: { text: string }) => {
      console.log('[InterviewRoom] ai:text received:', data.text?.substring(0, 50))
      if (!preloadedUsedRef.current && effectivePreloadedMessage) {
        setTypingMessage({ role: 'ai', text: effectivePreloadedMessage.text })
      } else {
        setTypingMessage({ role: 'ai', text: data.text })
      }
    })

    socket.on('ai:speaking', (speaking: boolean) => {
      setAiSpeaking(speaking)
    })

    socket.on('stt:result', (data: { text: string }) => {
      console.log('[InterviewRoom] stt:result received (ignoring - using whisper:result instead):', data.text?.substring(0, 30))
    })

    socket.on('whisper:result', (data: { id: string; text: string }) => {
      console.log('[whisper:result]', data)
    
      const id = data.id || currentUserMessageIdRef.current
      if (!id || !data.text) return
    
      updateMessage(id, data.text)
    
      if (socketRef.current?.connected) {
        socketRef.current.emit('user:text', {
          interviewId: interviewIdRef.current,
          id,
          text: data.text,
        })
      }
    })

    socket.on('interview:ended', () => {
      setPreloadedMessage(null)
      setPreloadedInterviewId(null)
      localStorage.removeItem('preloadedInterviewId')
      localStorage.removeItem('preloadedMessage')
      localStorage.removeItem('preloadedInterviewerName')
      localStorage.removeItem('preloadedInterviewerGender')
      localStorage.removeItem('preloadedInterviewerAvatar')
      endInterview()
      navigate('/history')
    })

    socket.on('disconnect', () => {
      endInterview()
    })

    ttsService.onSpeakingChange(setAiSpeaking)

    return () => {
      disconnectInterview()
      ttsService.stop()
    }
  }, [token])

  useEffect(() => {
    return () => {
      sttService.stop()
      ttsService.stop()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const storedMessage = localStorage.getItem('preloadedMessage')
    const msgToUse = storedMessage ? JSON.parse(storedMessage) : preloadedMessage
    console.log('[InterviewRoom] preloadedMessage effect triggered:', { 
      preloadedMessage: preloadedMessage ? 'exists' : 'null',
      storedMessage: storedMessage ? 'exists' : 'null',
      msgToUse: msgToUse ? 'exists' : 'null',
      preloadedUsed: preloadedUsedRef.current, 
      interviewStarted 
    })
    if (msgToUse && !preloadedUsedRef.current && interviewStarted === false) {
      preloadedUsedRef.current = true
      setInterviewStarted(true)
      startInterview()
      console.log('[InterviewRoom] Setting typing message:', msgToUse.text.substring(0, 50) + '...')
      setTypingMessage({ role: 'ai', text: msgToUse.text })
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
      socketRef.current?.emit('end', { interviewId: interviewIdRef.current })
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
        console.log('[InterviewRoom] Silence detected, stopping recording')
        sttService.stop()
        setUserSpeaking(false)
        setUserSpeakingText('')
        setIsRecording(false)
        const id = currentUserMessageIdRef.current
        const interviewId = interviewIdRef.current

        if (!id || !interviewId) return

        socketRef.current?.emit('audio:transcribe', {
          interviewId,
          id,
        })
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
    console.log('[InterviewRoom] Mic pressed')
  
    if (!socketRef.current?.connected) {
      console.log('[InterviewRoom] Socket not ready, aborting mic start')
      return
    }
    
    setSttError(null)
    accumulatedTextRef.current = ''
    webSpeechFinalTextRef.current = ''
    webSpeechSentRef.current = false
  
    const messageId = crypto.randomUUID()
    currentUserMessageIdRef.current = messageId
  
    // 🔥 cria mensagem otimista
    addMessage({
      id: messageId,
      role: 'user',
      text: '...', // ou '' se preferir
    })
  
    setUserSpeakingText('')
    setUserLiveText('')
    setLiveTranscriptActive(false)
    setIsRecording(true)
    setManualText('')
  
    sttServiceStartedRef.current = false
  
    // 🧠 WebSpeech = preview
    if (webSpeechService.isSupported()) {
      try {
        webSpeechService.onInterimResult((text) => {
          setUserLiveText(text)
          setLiveTranscriptActive(true)
  
          const id = currentUserMessageIdRef.current
          if (id) {
            updateMessage(id, text)
          }
        })
  
        webSpeechService.onResult((text) => {
          webSpeechFinalTextRef.current = text
  
          const id = currentUserMessageIdRef.current
          if (id && text.trim()) {
            updateMessage(id, text)
          }
  
          setUserLiveText('')
          setLiveTranscriptActive(false)
        })
  
        webSpeechService.onSpeakingChange((speaking) => {
          if (!speaking) {
            setLiveTranscriptActive(false)
          }
        })
  
        await webSpeechService.start()
        console.log('[InterviewRoom] WebSpeech started')
      } catch (err) {
        console.warn('[InterviewRoom] WebSpeech failed (fallback):', err)
      }
    }
  
    // Thruth Source
    if (!sttService.isSupported()) {
      setSttError('Voice recognition not available.')
      setIsRecording(false)
      return
    }
  
    if (sttStartPromiseRef.current) return
  
    sttStartPromiseRef.current = (async () => {
      try {
        await sttService.start({
          onSpeakingChange: (speaking) => {
            setUserSpeaking(speaking)
          },
          onChunk: async (chunk) => {

            if (!socketRef.current?.connected) {
              console.log('[WARN] socket not ready, dropping chunk')
              return
            }
          
            if (chunk.size < 200) {
              console.log('[IGNORED SMALL CHUNK]')
              return
            }
          
            const reader = new FileReader()
          
            reader.onloadend = () => {
              console.log('[EMIT] audio:chunk')

              socketRef.current?.emit('audio:chunk', {
                interviewId: interviewIdRef.current,
                audio: reader.result,
              })
            }
          
            reader.readAsDataURL(chunk)
          },
          onError: (error) => {
            console.error('[STT error]', error)
            setSttError(error)
            setIsRecording(false)
          },
        })
  
        sttServiceStartedRef.current = true
      } catch (err) {
        console.error('[MediaRecorder error]', err)
        setIsRecording(false)
      } finally {
        sttStartPromiseRef.current = null
      }
    })()
    
    await sttStartPromiseRef.current
  }

  const handleManualSubmit = () => {
    console.log('[InterviewRoom] handleManualSubmit called, socketRef:', socketRef.current?.id, 'interviewId:', interviewIdRef.current);
    const text = manualText.trim()
    if (text) {
      addMessage({ role: 'user', text })
      if (socketRef.current?.connected) {
        console.log('[InterviewRoom] Emitting user:text');
        socketRef.current.emit('user:text', { interviewId: interviewIdRef.current, text })
      } else {
        console.log('[InterviewRoom] Socket not connected!');
      }
    }
    setManualText('')
    setSttError(null)
  }

  const handleMicRelease = async () => {
    console.log('[InterviewRoom] Mic released')
  
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
  
    if (sttStartPromiseRef.current) {
      await sttStartPromiseRef.current
    }
  
    if (sttServiceStartedRef.current) {
      sttService.stop()
    }
  
    webSpeechService.stop()
  
    setUserSpeaking(false)
    setUserLiveText('')
    setLiveTranscriptActive(false)
    setIsRecording(false)
  
    const id = currentUserMessageIdRef.current
  
    // 🔥 só dispara transcrição final (não cria mensagem!)
    socketRef.current?.emit('audio:transcribe', {
      interviewId: interviewIdRef.current,
      id,
    })
  }

  const handleEndInterview = () => {
    socketRef.current?.emit('end', { interviewId: interviewIdRef.current })
    ttsService.stop()
    setPreloadedMessage(null)
    setPreloadedInterviewId(null)
    localStorage.removeItem('preloadedInterviewId')
    localStorage.removeItem('preloadedMessage')
    localStorage.removeItem('preloadedInterviewerName')
    localStorage.removeItem('preloadedInterviewerGender')
    localStorage.removeItem('preloadedInterviewerAvatar')
    endInterview()
    navigate('/history')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen max-h-[100vh] bg-zinc-950 flex flex-col h-screen overflow-hidden">
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
          <SpeakingCircle label={interviewerName || 'AI'} isSpeaking={isAiSpeaking} size="lg" avatar={interviewerAvatar} />
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
            size="lg"
            isUserCircle
            showMicButton
            onMicPress={handleMicPress}
            onMicRelease={handleMicRelease}
            avatar={userAvatar}
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
            <ConversationLog messages={conversationLog} typingMessage={typingMessage} userLiveText={userLiveText} />
          </div>
        )}
        
        {(userLiveText || liveTranscriptActive) && (
          <LiveTranscript text={userLiveText} isActive={liveTranscriptActive} />
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
