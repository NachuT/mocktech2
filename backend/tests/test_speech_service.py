import pytest
import os
from unittest.mock import patch, MagicMock
from app.services.speech_service import SpeechService

@pytest.fixture
def speech_service():
    with patch('vosk.Model') as mock_model:
        service = SpeechService()
        service.model = mock_model
        yield service

def test_save_audio(speech_service, tmp_path):
    # Create test audio data
    test_audio = bytes([0, 1, 2, 3, 4, 5])
    filename = "test_audio.raw"
    
    # Patch os.path.dirname to use tmp_path
    with patch('os.path.dirname', return_value=str(tmp_path)):
        result = speech_service.save_audio(test_audio, filename)
    
    assert result["success"] is True
    assert os.path.exists(result["file_path"])
    
    # Verify file contents
    with open(result["file_path"], 'rb') as f:
        saved_data = f.read()
        assert saved_data == test_audio

def test_transcribe_file_success(speech_service):
    # Mock file and transcription
    test_file = "test.raw"
    expected_text = "test transcription"
    
    mock_recognizer = MagicMock()
    mock_recognizer.AcceptWaveform.return_value = True
    mock_recognizer.Result.return_value = f'{{"text": "{expected_text}"}}'
    
    with patch('vosk.KaldiRecognizer', return_value=mock_recognizer):
        with patch('builtins.open', MagicMock()):
            result = speech_service.transcribe_file(test_file)
    
    assert result["success"] is True
    assert result["text"] == expected_text

def test_transcribe_file_not_found(speech_service):
    result = speech_service.transcribe_file("nonexistent.raw")
    
    assert result["success"] is False
    assert "File not found" in result["error"]

def test_transcribe_file_failure(speech_service):
    # Mock file exists but transcription fails
    test_file = "test.raw"
    
    mock_recognizer = MagicMock()
    mock_recognizer.AcceptWaveform.return_value = False
    
    with patch('os.path.exists', return_value=True):
        with patch('vosk.KaldiRecognizer', return_value=mock_recognizer):
            with patch('builtins.open', MagicMock()):
                result = speech_service.transcribe_file(test_file)
    
    assert result["success"] is False
    assert "Failed to transcribe audio" in result["error"] 