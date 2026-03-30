import { STTService } from '@/types/audio'

export class WebSpeechSTT implements STTService {
  private recognition: any = null;
  private resultCallback?: (text: string) => void;
  private interimCallback?: (text: string) => void;
  private speakingCallback?: (speaking: boolean) => void;
  private speechStarted = false;

  private createRecognition(): any {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return null;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
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
        this.speechStarted = false;
        this.speakingCallback?.(false);
        this.resultCallback?.(finalTranscript.trim());
      }
    };

    recognition.onspeechend = () => {
      console.log('[STT] Speech ended');
      this.speechStarted = false;
      this.speakingCallback?.(false);
    };

    recognition.onerror = (event: any) => {
      console.log('[STT] Error:', event.error);
      this.speechStarted = false;
      this.speakingCallback?.(false);
    };

    return recognition;
  }

  async start(): Promise<void> {
    this.speechStarted = false;
    
    this.recognition = this.createRecognition();
    
    if (!this.recognition) {
      throw new Error('Speech Recognition not supported');
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech Recognition not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        console.log('[STT] Start timeout');
        resolve();
      }, 500);

      this.recognition.onstart = () => {
        console.log('[STT] Recognition started');
        clearTimeout(timeout);
        resolve();
      };

      this.recognition.onerror = (event: any) => {
        console.log('[STT] Start error:', event.error);
        clearTimeout(timeout);
        if (event.error === 'not-allowed') {
          reject(new Error('Microphone not allowed'));
        } else {
          resolve();
        }
      };

      try {
        this.recognition.start();
      } catch (err) {
        console.log('[STT] Start exception:', err);
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.log('[STT] Stop error:', err);
      }
    }
    this.recognition = null;
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
