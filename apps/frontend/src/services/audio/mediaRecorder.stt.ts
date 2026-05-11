export interface AudioChunkCallback {
  (chunk: Blob): void
}

export interface STTCallbacks {
  onSpeakingChange?: (speaking: boolean) => void
  onChunk?: AudioChunkCallback
  onError?: (error: string) => void
}

export class MediaRecorderService {
  private mediaStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private isRecording = false
  private isStopped = false
  private callbacks: STTCallbacks = {}
  private chunkInterval = 250

  async start(callbacks: STTCallbacks): Promise<void> {
    if (this.isRecording) {
      console.log('[MediaRecorderService] Already recording')
      return
    }

    this.callbacks = callbacks
    this.isStopped = false
    console.log('[MediaRecorderService] Starting...')

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      console.log('[MediaRecorderService] MediaStream obtained')

      const mimeType = this.getSupportedMimeType()
      console.log('[MediaRecorderService] Using MIME type:', mimeType || 'default')

      const recorderOptions: MediaRecorderOptions = {}
      if (mimeType) {
        recorderOptions.mimeType = mimeType
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, recorderOptions)

      this.mediaRecorder.ondataavailable = (event) => {
        if (this.isStopped) return
        if (event.data.size > 0) {
          console.log('[MediaRecorderService] Audio chunk available:', event.data.size)
      
          console.log('[DEBUG] callbacks object:', this.callbacks)
          console.log('[DEBUG] has onChunk?', !!this.callbacks.onChunk)
      
          this.callbacks.onChunk?.(event.data)
        }
      }

      this.mediaRecorder.onerror = (event: any) => {
        console.error('[MediaRecorderService] MediaRecorder error:', event)
        this.callbacks.onError?.('MediaRecorder error: ' + event.message)
        this.isStopped = true
      }

      this.mediaRecorder.onstop = () => {
        console.log('[MediaRecorderService] MediaRecorder stopped')
      }

      this.mediaRecorder.start(this.chunkInterval)
      this.isRecording = true
      this.callbacks.onSpeakingChange?.(true)
      console.log('[MediaRecorderService] Recording started')
    } catch (error: any) {
      console.error('[MediaRecorderService] Failed to start:', error)
      this.callbacks.onError?.(error.message || 'Failed to start recording')
      this.cleanup()
      throw error
    }
  }

  stop(): void {
    console.log('[MediaRecorderService] Stopping...')
    this.isStopped = true
    this.cleanup()
  }

  private cleanup(): void {
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop()
      } catch (e) {
        console.log('[MediaRecorderService] MediaRecorder stop error:', e)
      }
      this.isRecording = false
      console.log('[MediaRecorderService] Recording stopped')
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          console.log('[MediaRecorderService] Track stop error:', e)
        }
      })
      this.mediaStream = null
      console.log('[MediaRecorderService] MediaStream tracks stopped')
    }

    this.callbacks.onSpeakingChange?.(false)
    this.callbacks = {}
  }

  isSupported(): boolean {
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
    return hasMediaDevices && hasMediaRecorder
  }

  isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  }

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
  }

  private getSupportedMimeType(): string {
    const isSafari = this.isSafari()
    const isIOS = this.isIOS()

    let types: string[]

    if (isIOS) {
      types = [
        'audio/mp4',
        'audio/m4a',
        'audio/aac',
      ]
    } else if (isSafari) {
      types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
      ]
    } else {
      types = [
        'audio/webm;codecs=opus',
        'audio/webm;codecs=vp8',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ]
    }

    for (const type of types) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          console.log('[MediaRecorderService] MIME type supported:', type)
          return type
        }
      } catch (e) {
        console.log('[MediaRecorderService] Error checking MIME type:', type, e)
      }
    }

    console.log('[MediaRecorderService] No specific MIME type supported, using default')
    return ''
  }
}
