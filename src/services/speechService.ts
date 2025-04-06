import { useState, useRef, useEffect } from 'react';

interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export const useSpeechRecognition = (
  onResult: (text: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognitionConstructor) {
      recognitionRef.current = new SpeechRecognitionConstructor();
      
      // Configure recognition
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        
        // Set up event handlers
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          
          const isFinal = event.results[event.results.length - 1].isFinal;
          onResult(transcript, isFinal);
        };
        
        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === 'no-speech') {
            // Ignore no-speech errors as they're common
            return;
          }
          onError(event.error);
          stopListening();
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
          onEnd();
        };
      }
      
      setIsSupported(true);
    } else {
      setIsSupported(false);
      onError('Speech recognition is not supported in this browser');
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        stopListening();
      }
    };
  }, [onResult, onError, onEnd]);

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;
    
    try {
      // Ensure any existing recognition is stopped
      stopListening();
      
      // Small delay to ensure previous instance is fully stopped
      setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.start();
          setIsListening(true);
        }
      }, 100);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      onError('Failed to start speech recognition');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    
    try {
      if (isListening) {
        recognitionRef.current.stop();
      }
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
    setIsListening(false);
  };

  return {
    isListening,
    isSupported,
    startListening,
    stopListening
  };
}; 