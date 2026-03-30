import { STTService } from '@/types/audio'

type SpeechRecognitionResultItem = {
  0: { transcript: string };
  isFinal: boolean;
  length: 2;
};

type SpeechRecognitionResults = {
  length: number;
  [index: number]: SpeechRecognitionResultItem;
};

type SpeechRecognitionEventResult = {
  results: SpeechRecognitionResults;
  resultIndex: number;
};

type SpeechRecognitionType = {
  new (): {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEventResult) => void) | null;
    onspeechend: (() => void) | null;
    onerror: ((event: Event) => void) | null;
    start: () => void;
    stop: () => void;
  };
};

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionType;
    webkitSpeechRecognition: SpeechRecognitionType;
  }
}

export class WebSpeechSTT implements STTService {
  private recognition: any = null;
  private resultCallback?: (text: string) => void;
  private interimCallback?: (text: string) => void;
  private speakingCallback?: (speaking: boolean) => void;
  private speechStarted = false;

  constructor() {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let latestInterim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            latestInterim = result[0].transcript;
          }
        }

        if (latestInterim) {
          console.log('[STT] Interim:', latestInterim);
          if (!this.speechStarted) {
            this.speechStarted = true;
            this.speakingCallback?.(true);
          }
          this.interimCallback?.(latestInterim.trim());
        }

        if (finalTranscript) {
          console.log('[STT] Final:', finalTranscript);
          this.resultCallback?.(finalTranscript.trim());
        }
      };

      recognition.onspeechend = () => {
        console.log('[STT] Speech ended');
        this.speakingCallback?.(false);
      };

      recognition.onerror = (event: any) => {
        console.log('[STT] Error:', event.error);
        this.speechStarted = false;
        this.speakingCallback?.(false);
      };

      this.recognition = recognition;
    }
  }

  async start(): Promise<void> {
    if (this.recognition) {
      this.speechStarted = false;
      try {
        this.recognition.start();
      } catch (err) {
        console.log('[STT] Start error (might already be running):', err);
      }
    }
  }

  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.log('[STT] Stop error (might already be stopped):', err);
      }
    }
    this.speechStarted = false;
    this.speakingCallback?.(false);
  }

  onResult(callback: (text: string) => void): void {
    this.resultCallback = callback;
  }

  onInterimResult(callback: (text: string) => void): void {
    this.interimCallback = callback;
  }

  onSpeakingChange(callback: (speaking: boolean) => void): void {
    this.speakingCallback = callback;
  }

  isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
}
