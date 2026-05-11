export class WebSpeechSTT {
  private recognition: any = null;
  private resultCallback?: (text: string) => void;
  private interimCallback?: (text: string) => void;
  private speakingCallback?: (speaking: boolean) => void;
  private speechStarted = false;

  private createRecognition(): any {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return null;

    const recognition = new SpeechRecognitionClass();

    recognition.continuous = true; // ✅ importante
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
        if (!this.speechStarted) {
          this.speechStarted = true;
          this.speakingCallback?.(true);
        }
        this.interimCallback?.(latestInterim.trim());
      }

      if (finalTranscript) {
        this.speechStarted = false;
        this.speakingCallback?.(false);
        this.resultCallback?.(finalTranscript.trim());
      }
    };

    recognition.onspeechend = () => {
      this.speechStarted = false;
      this.speakingCallback?.(false);
    };

    return recognition;
  }

  async start(): Promise<void> {
    this.speechStarted = false;

    const recognition = this.createRecognition();
    if (!recognition) {
      throw new Error('Speech Recognition not supported');
    }

    this.recognition = recognition;

    return new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        recognition.onstart = null;
        recognition.onerror = null;
      };

      const timeout = setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error('Speech recognition timeout'));
        }
      }, 1500); // ✅ mais seguro

      recognition.onstart = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve();
      };

      recognition.onerror = (event: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        cleanup();

        if (event.error === 'not-allowed') {
          reject(new Error('Microphone not allowed'));
        } else if (event.error === 'network') {
          reject(new Error('Network error'));
        } else {
          reject(new Error('Speech recognition error: ' + event.error));
        }
      };

      try {
        recognition.start();
      } catch (err) {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Speech recognition start exception'));
      }
    });
  }

  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.onspeechend = null;

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
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }
}