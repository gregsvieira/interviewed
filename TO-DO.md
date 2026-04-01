# TO-DO

## Audio Streaming Refactor

### Remove SpeechRecognition API
- [x] Remove SpeechRecognition API usage
- [x] Remove webkitSpeechRecognition fallback
- [x] Remove recognition event handlers (onresult, onerror, onend)

### Implement Audio Capture with getUserMedia
- [x] Implement getUserMedia for audio capture
- [x] Store and manage MediaStream lifecycle
- [x] Stop tracks on cleanup

### Implement MediaRecorder
- [x] Implement MediaRecorder
- [x] Configure ondataavailable handler
- [x] Stream audio chunks via WebSocket
- [x] Set chunk interval (e.g., 250ms)
- [x] Ensure WebSocket connection before streaming
- [x] Emit audio:chunk events

### Backend Audio Processing
- [x] Receive audio chunks on backend
- [x] Convert Blob to Buffer
- [x] Normalize audio format (PCM 16-bit, 16kHz, mono)
- [x] Integrate STT engine (e.g., Whisper)

### Cross-Browser Audio Handling
- [x] Detect and handle MIME types (webm, mp4)
- [x] Normalize audio formats across browsers

### Security & Permissions
- [x] Enforce HTTPS or localhost
- [x] Handle permission errors (NotAllowedError)
- [x] Ensure user interaction before mic access
- [ ] Handle Safari/iOS restrictions

### Cleanup & Memory Management
- [x] Stop MediaRecorder on unmount
- [x] Close MediaStream tracks
- [x] Disconnect WebSocket
- [x] Prevent memory leaks

### Monitoring & Debugging
- [x] Add logging for audio lifecycle events
- [ ] Measure end-to-end latency

## Silence Detection (Lightweight Alternative to AudioWorklet)
- [ ] Implement RMS (Root Mean Square) calculation for audio levels
- [ ] Set silence threshold (e.g., RMS < 0.02)
- [ ] Only emit audio chunks when audio level > threshold
- [ ] This reduces bandwidth ~50% without AudioWorklet complexity


# BUGS

### Bug 1: Multi-click to start InterviewRoom
- **Description**: Need to click the "Start Interview" button ~4 times to navigate to InterviewRoom
- **Priority**: High
- **Status**: ✅ FIXED

### Bug 2: Preloaded data not loading immediately
- **Description**: Preloaded message/interviewer data only appears after several seconds, should be ready before interview starts
- **Priority**: High
- **Status**: ✅ FIXED
- **Fix**: Countdown waits for preloaded data before navigating

### Bug 3: Voice collection inconsistent across browsers
- **Description**: Voice is not being captured consistently across browsers. Text doesn't appear in real-time during speech
- **Priority**: High
- **Status**: ✅ FIXED
- **Fix**: Refactored to use MediaRecorderService separately from WebSocket, socket stays open for transcription result

### Bug 4: Logs de debug ainda presentes no frontend
- **Description**: Logs de debug adicionados durante investigação ainda estão no código
- **Priority**: Medium
- **Status**: ✅ FIXED
- **Fix**: Removidos logs como `[Socket] Event received`, logs detalhados de `interview:started`, e logs verbosos de chunks

### Bug 5: Whisper não está funcionando (404 no /api/audio)
- **Description**: Modelo whisper-small não foi baixado corretamente, resultando em erro 404 ao chamar /api/audio
- **Priority**: High
- **Status**: ✅ FIXED
- **Causa**: Nome do modelo estava errado no Ollama. O modelo correto é `karanchopda333/whisper`
- **Fix**: 
  - Atualizado `ollama.service.ts` para usar `karanchopda333/whisper`
  - Atualizado `entrypoint.sh` para baixar o modelo correto
  - Baixado modelo manualmente: `docker exec interviewed-ollama ollama pull karanchopda333/whisper`

### Bug 6: Nginx com muitos worker processes (42)
- **Description**: Nginx cria workers baseado nos CPU cores do host, resultando em 42 processos
- **Priority**: Low
- **Status**: 📝 Para otimizar depois
- **Fix**: Modificar nginx.conf para usar `worker_processes 1;`

