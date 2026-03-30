import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { INTERVIEW_DURATIONS } from '@/lib/constants'
import { WS_URL } from '@/lib/utils'
import { interviewApi } from '@/services/api/interview.api'
import { LevelOption, useInterviewStore } from '@/stores/interview.store'
import { Gender } from '@/types/audio'
import { Subtopic, Topic } from '@/types/interview'
import { AlertCircle, Check, Mic, MicOff, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

const LEVEL_OPTIONS: { value: LevelOption; label: string }[] = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
]

type MicTestStatus = 'idle' | 'testing' | 'success' | 'failed'

export function ConfigScreen() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [selectedSubtopic, setSelectedSubtopic] = useState<Subtopic | null>(null)
  const [duration, setDuration] = useState<number>(15)
  const [level, setLevel] = useState<LevelOption>('mid')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [preloading, setPreloading] = useState(false)
  const [micTestStatus, setMicTestStatus] = useState<MicTestStatus>('idle')
  const socketRef = useRef<Socket | null>(null)
  const preloadedDataRef = useRef<{ text: string; interviewerName: string; interviewerGender?: Gender } | null>(null)
  const navigate = useNavigate()
  const { setConfig, setPreloadedMessage } = useInterviewStore()
  const recognitionRef = useRef<any>(null)
  const micStatusRef = useRef<MicTestStatus>('idle');

  useEffect(() => {
    interviewApi.getTopics().then(setTopics).catch(() => {
      setTopics([
        {
          id: '1',
          name: 'Software Development',
          subtopics: [
            { id: '1-1', name: 'Frontend' },
            { id: '1-2', name: 'Backend' },
            { id: '1-3', name: 'DevOps' },
          ],
        },
        {
          id: '2',
          name: 'Database',
          subtopics: [
            { id: '2-1', name: 'SQL' },
            { id: '2-2', name: 'NoSQL' },
          ],
        },
      ])
    })
  }, [])

  useEffect(() => {
    if (countdown === null) return

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      if (preloadedDataRef.current) {
        setPreloadedMessage(preloadedDataRef.current)
      }
      setConfig(selectedTopic, selectedSubtopic, duration, level)
      navigate('/interview')
    }
  }, [countdown, selectedTopic, selectedSubtopic, duration, level, micTestStatus])

  const handleMouseEnter = () => {
    if (!selectedTopic || !selectedSubtopic || countdown !== null || preloading || preloadedDataRef.current) return
    if (micTestStatus !== 'success') return
    setPreloading(true)
    startPreload()
  }


const testMicrophone = async () => {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  setMicTestStatus('testing');
  micStatusRef.current = 'testing'; 

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    console.log('[Config] Microphone permission granted');
  } catch (err) {
    console.error('[Config] Microphone permission denied:', err);
    setMicTestStatus('failed');
    micStatusRef.current = 'failed';
    return;
  }

  const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognitionClass || isSafari) {
    console.log('[Config] Speech Recognition not supported, proceeding anyway');
    micStatusRef.current = 'success';
    setMicTestStatus('success');
    setPreloading(true);
    startPreload();
    return;
  }

  try {
    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      console.log('[Config] Speech recognition result:', event);
      if (micStatusRef.current === 'testing') {
        micStatusRef.current = 'success';
        setMicTestStatus('success');
        recognition.stop();
        setTimeout(() => {
          setPreloading(true);
          startPreload();
        }, 100);
      }
    };

    recognition.onerror = (event: any) => {
      console.log('[Config] Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      console.log('[Config] Speech recognition ended, status:', micStatusRef.current);
      if (micStatusRef.current === 'testing') {
        micStatusRef.current = 'success';
        setMicTestStatus('success');
        setPreloading(true);
        startPreload();
      }
    };

    console.log('[Config] Starting speech recognition...');
    recognition.start();

    setTimeout(() => {
      console.log('[Config] Timeout reached, status:', micStatusRef.current);
      if (micStatusRef.current === 'testing') {
        micStatusRef.current = 'success';
        setMicTestStatus('success');
        try { recognition.stop(); } catch {}
        setPreloading(true);
        startPreload();
      }
    }, 3000);

  } catch (error) {
    console.error('[Config] Speech recognition error:', error);
    micStatusRef.current = 'success';
    setMicTestStatus('success');
    setPreloading(true);
    startPreload();
  }
}


  const startPreload = () => {
    const token = localStorage.getItem('token')
    if (!token) return

    socketRef.current = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    })

    socketRef.current.on('connect', () => {
      socketRef.current?.emit('start', {
        topic: selectedTopic?.name,
        subtopic: selectedSubtopic?.name,
        level: level,
        duration: duration,
        candidateName: 'Candidate',
      })
    })

    socketRef.current.on('ai:text', (data: { text: string; interviewerName?: string; interviewerGender?: Gender }) => {
      preloadedDataRef.current = {
        text: data.text,
        interviewerName: data.interviewerName || 'Interviewer',
        interviewerGender: data.interviewerGender,
      }
      setPreloading(false)
      socketRef.current?.disconnect()
      socketRef.current = null
    })

    socketRef.current.on('connect_error', () => {
      setPreloading(false)
    })
  }

  const handleStart = () => {
    if (selectedTopic && selectedSubtopic) {
      if (micTestStatus !== 'success' && micTestStatus !== 'testing') {
        testMicrophone()
        return
      }
      if (micTestStatus === 'success' && preloadedDataRef.current) {
        preloadedDataRef.current = null
        setPreloading(false)
        setCountdown(3)
      }
    }
  }

  const handleCancel = () => {
    setCountdown(null)
    setPreloading(false)
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
  }

  const isStarting = countdown !== null

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 text-center">
            {isStarting ? 'Get Ready!' : 'Interview Configuration'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isStarting ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-zinc-700"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - (3 - (countdown || 0)) / 3)}`}
                    strokeLinecap="round"
                    className="text-blue-500 transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold text-zinc-100">{countdown}</span>
                </div>
              </div>
              <p className="text-zinc-400 text-center">
                {preloading ? 'Preparing interview...' : `Starting in ${countdown}seg...`}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-zinc-300">Topic</Label>
                <Select
                  onValueChange={(id) => {
                    setSelectedTopic(topics.find((t) => t.id === id) || null)
                    setSelectedSubtopic(null)
                  }}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Subtopic</Label>
                <Select
                  onValueChange={(id) => {
                    setSelectedSubtopic(selectedTopic?.subtopics.find((s) => s.id === id) || null)
                  }}
                  disabled={!selectedTopic}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                    <SelectValue placeholder="Select a subtopic" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTopic?.subtopics.map((subtopic) => (
                      <SelectItem key={subtopic.id} value={subtopic.id}>
                        {subtopic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Level</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as LevelOption)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Duration</Label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_DURATIONS.map((d) => (
                      <SelectItem key={d} value={d.toString()}>
                        {d} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Microphone Test</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={testMicrophone}
                    disabled={micTestStatus === 'testing' || !selectedTopic || !selectedSubtopic}
                    className={`flex-1 ${
                      micTestStatus === 'success' ? 'border-green-500 bg-green-500/20' : 
                      micTestStatus === 'failed' ? 'border-red-500 bg-red-500/20' : ''
                    }`}
                  >
                    {micTestStatus === 'idle' && (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        Test Microphone
                      </>
                    )}
                    {micTestStatus === 'testing' && (
                      <>
                        <Mic className="w-4 h-4 mr-2 animate-pulse" />
                        Testing...
                      </>
                    )}
                    {micTestStatus === 'success' && (
                      <>
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Ready
                      </>
                    )}
                    {micTestStatus === 'failed' && (
                      <>
                        <MicOff className="w-4 h-4 mr-2 text-red-500" />
                        Failed - Click to Retry
                      </>
                    )}
                  </Button>
                  {micTestStatus === 'failed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMicTestStatus('idle')
                        preloadedDataRef.current = null
                      }}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Use Manual Mode
                    </Button>
                  )}
                </div>
                {micTestStatus === 'idle' && (
                  <p className="text-center text-zinc-500 text-xs">Click to test microphone</p>
                )}
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          {isStarting ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          ) : (
            <Button
              className={`w-full ${
                micTestStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={!selectedTopic || !selectedSubtopic || (micTestStatus !== 'success')}
              onClick={handleStart}
              onMouseEnter={handleMouseEnter} 
            >
              <Play className="w-4 h-4 mr-2" />
              Start Interview
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
