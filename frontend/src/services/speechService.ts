import { useState, useEffect, useRef, useCallback } from 'react';

// Speech recognition interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

// Speech recognition event interface
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

// Speech recognition result interface
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

// Speech recognition result interface
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

// Speech recognition alternative interface
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Speech recognition error event interface
interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

// Declare the global SpeechRecognition interface
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Get the SpeechRecognition constructor
const SpeechRecognition = 
  window.SpeechRecognition || 
  window.webkitSpeechRecognition;

/**
 * Hook for speech recognition
 * @param onResult Callback for when speech is recognized
 * @param onError Callback for when an error occurs
 * @param onEnd Callback for when speech recognition ends
 * @returns Object with start, stop, and isListening functions
 */
export const useSpeechRecognition = (
  onResult: (transcript: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onEnd?: () => void
) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastTranscriptRef = useRef<string>('');

  useEffect(() => {
    // Check if speech recognition is supported
    if (!SpeechRecognition) {
      console.error('Speech recognition is not supported in this browser');
      return;
    }

    // Create a new speech recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Set up event handlers
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Get the latest result
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript;
      const isFinal = lastResult.isFinal;
      
      // Log what was heard
      console.log('Speech recognized:', transcript, 'Final:', isFinal);
      
      // Only send the new part of the transcript to avoid repetition
      if (isFinal) {
        // For final results, send the entire transcript
        onResult(transcript, true);
        lastTranscriptRef.current = '';
      } else {
        // For interim results, only send the new part
        const newPart = transcript.substring(lastTranscriptRef.current.length);
        if (newPart) {
          onResult(newPart, false);
        }
        lastTranscriptRef.current = transcript;
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (onError) {
        onError(event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (onEnd) {
        onEnd();
      }
    };

    recognitionRef.current = recognition;

    // Clean up on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult, onError, onEnd]);

  // Start listening
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return {
    startListening,
    stopListening,
    isListening,
    isSupported: !!SpeechRecognition
  };
};

/**
 * Hook for text-to-speech
 * @param text Text to speak
 * @param onEnd Callback for when speech ends
 * @returns Object with speak and stop functions
 */
export const useTextToSpeech = (
  text: string,
  onEnd?: () => void
) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 3;
  const isQueuedRef = useRef<boolean>(false);
  const queueTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minSpeakingTimeRef = useRef<number>(5000); // Minimum 5 seconds of speaking time
  const speakingStartTimeRef = useRef<number>(0);
  const textToSpeakRef = useRef<string>(text);

  // Update the text reference when text changes
  useEffect(() => {
    textToSpeakRef.current = text;
  }, [text]);

  useEffect(() => {
    // Check if browser supports speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      speechSynthesisRef.current = window.speechSynthesis;
    }

    return () => {
      // Clean up on unmount
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
      }
    };
  }, []);

  const speak = useCallback(() => {
    if (!speechSynthesisRef.current || !textToSpeakRef.current) return;
    
    console.log('Starting text-to-speech with text:', textToSpeakRef.current);
    
    // Cancel any ongoing speech
    if (isSpeaking) {
      speechSynthesisRef.current.cancel();
    }
    
    // Reset retry count
    retryCountRef.current = 0;
    isCancelledRef.current = false;
    
    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(textToSpeakRef.current);
    utteranceRef.current = utterance;
    
    // Set speech properties
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Get available voices and set to a female voice if available
    const voices = speechSynthesisRef.current.getVoices();
    const femaleVoice = voices.find(voice => 
      voice.name.includes('female') || 
      voice.name.includes('Female') || 
      voice.name.includes('Samantha') || 
      voice.name.includes('Google US English Female')
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    // Set up event handlers
    utterance.onstart = () => {
      console.log('Speech started');
      setIsSpeaking(true);
      speakingStartTimeRef.current = Date.now();
      isQueuedRef.current = false;
    };
    
    utterance.onend = () => {
      console.log('Speech ended');
      
      // Calculate how long the speech has been running
      const speakingTime = Date.now() - speakingStartTimeRef.current;
      
      // If the speech ended too quickly (less than minSpeakingTime), it might have been interrupted
      if (speakingTime < minSpeakingTimeRef.current && !isCancelledRef.current) {
        console.log(`Speech ended too quickly (${speakingTime}ms), might have been interrupted`);
        
        // Only retry if we haven't exceeded max retries
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log(`Retrying speech (attempt ${retryCountRef.current}/${maxRetries})`);
          
          // Add a small delay before retrying
          setTimeout(() => {
            if (!isCancelledRef.current) {
              speak();
            }
          }, 500);
          return;
        }
      }
      
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      
      // Check if the error is "interrupted"
      if (event.error === 'interrupted' && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`Retrying speech after interruption (attempt ${retryCountRef.current}/${maxRetries})`);
        
        // Add a small delay before retrying
        setTimeout(() => {
          if (!isCancelledRef.current) {
            speak();
          }
        }, 500);
        return;
      }
      
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    
    // Check if speech synthesis is already in progress
    if (speechSynthesisRef.current.speaking) {
      console.log('Speech synthesis already in progress, queueing...');
      isQueuedRef.current = true;
      
      // Set a timeout to prevent infinite queuing
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
      }
      
      queueTimeoutRef.current = setTimeout(() => {
        if (isQueuedRef.current) {
          console.log('Queue timeout reached, forcing speech to start');
          speechSynthesisRef.current?.cancel();
          isQueuedRef.current = false;
          speechSynthesisRef.current?.speak(utterance);
        }
      }, 5000);
      
      return;
    }
    
    // Speak the text
    speechSynthesisRef.current.speak(utterance);
  }, [isSpeaking, onEnd]);

  const stop = useCallback(() => {
    if (speechSynthesisRef.current) {
      isCancelledRef.current = true;
      speechSynthesisRef.current.cancel();
      setIsSpeaking(false);
      if (onEnd) onEnd();
    }
  }, [onEnd]);

  return { speak, stop, isSpeaking, isSupported };
}; 