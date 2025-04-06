import os
import wave
import json
from vosk import Model, KaldiRecognizer
import sounddevice as sd
import numpy as np
import queue
import threading
from datetime import datetime

class SpeechService:
    def __init__(self):
        self.model_path = os.path.join(os.path.dirname(__file__), '../../models/vosk-model-small-en-us-0.15')
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Vosk model not found at {self.model_path}")
        
        self.model = Model(self.model_path)
        self.recognizer = KaldiRecognizer(self.model, 16000)
        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.recording_thread = None

    def stream_recognition(self):
        """Stream audio from microphone and yield recognized text."""
        self.is_recording = True
        self.recording_thread = threading.Thread(target=self._record_audio)
        self.recording_thread.start()

        while self.is_recording:
            if not self.audio_queue.empty():
                audio_data = self.audio_queue.get()
                if self.recognizer.AcceptWaveform(audio_data):
                    result = json.loads(self.recognizer.Result())
                    if result.get("text"):
                        yield result["text"]

    def _record_audio(self):
        """Record audio from microphone and put it in the queue."""
        def callback(indata, frames, time, status):
            if status:
                print(status)
            self.audio_queue.put(bytes(indata))

        with sd.RawInputStream(
            samplerate=16000,
            blocksize=8000,
            dtype=np.int16,
            channels=1,
            callback=callback
        ):
            while self.is_recording:
                sd.sleep(100)

    def stop_recording(self):
        """Stop the recording process."""
        self.is_recording = False
        if self.recording_thread:
            self.recording_thread.join()

    def save_audio(self, audio_file):
        """Save uploaded audio file."""
        recordings_dir = os.path.join(os.path.dirname(__file__), '../../recordings')
        os.makedirs(recordings_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = os.path.join(recordings_dir, f'recording_{timestamp}.wav')
        
        audio_file.save(file_path)
        return file_path

    def transcribe_file(self, file_path):
        """Transcribe a saved audio file."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        wf = wave.open(file_path, "rb")
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getcomptype() != "NONE":
            raise ValueError("Audio file must be WAV format mono PCM.")

        recognizer = KaldiRecognizer(self.model, wf.getframerate())
        recognizer.SetWords(True)

        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if recognizer.AcceptWaveform(data):
                pass

        result = json.loads(recognizer.FinalResult())
        return result.get("text", "") 