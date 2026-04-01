from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import tempfile
import os
import wave
import struct
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

MODEL_SIZE = os.environ.get('MODEL_SIZE', 'base')
COMPUTE_TYPE = os.environ.get('COMPUTE_TYPE', 'int8')

model = None

def load_model():
    global model
    logger.info(f"Loading Whisper model: {MODEL_SIZE} ({COMPUTE_TYPE})")
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type=COMPUTE_TYPE)
    logger.info("Model loaded successfully")

def convert_to_wav(audio_data: bytes, original_format: str = 'webm') -> bytes:
    with tempfile.NamedTemporaryFile(suffix=f'.{original_format}', delete=False) as input_file:
        input_file.write(audio_data)
        input_path = input_file.name
    
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as output_file:
        output_path = output_file.name
    
    try:
        os.system(f'ffmpeg -y -i {input_path} -ar 16000 -ac 1 -acodec pcm_s16le {output_path} 2>/dev/null')
        
        with open(output_path, 'rb') as f:
            wav_data = f.read()
        
        return wav_data
    finally:
        os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)

def transcribe_audio(audio_data: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        f.write(audio_data)
        temp_path = f.name
    
    try:
        segments, info = model.transcribe(temp_path, beam_size=5, language='en')
        
        transcription = ' '.join([segment.text for segment in segments])
        return transcription.strip()
    finally:
        os.unlink(temp_path)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'model': MODEL_SIZE})

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if not request.data:
        return jsonify({'error': 'No audio provided'}), 400
    
    try:
        audio_data = request.data
        content_type = request.content_type or ''
        
        if 'webm' in content_type or 'audio/webm' in content_type:
            audio_data = convert_to_wav(audio_data, 'webm')
        elif 'ogg' in content_type:
            audio_data = convert_to_wav(audio_data, 'ogg')
        
        logger.info(f"Transcribing {len(audio_data)} bytes of audio")
        text = transcribe_audio(audio_data)
        logger.info(f"Transcription result: {text[:100]}...")
        
        return jsonify({'text': text})
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'service': 'faster-whisper-stt',
        'model': MODEL_SIZE,
        'endpoints': ['/health', '/transcribe']
    })

if __name__ == '__main__':
    load_model()
    port = int(os.environ.get('PORT', 8001))
    app.run(host='0.0.0.0', port=port)
