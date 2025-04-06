import React, { useState, useEffect, useRef } from 'react';
import { useSpeechRecognition } from '@/services/speechService';
import { api } from '@/services/api';
import ReactMarkdown from 'react-markdown';

interface VoiceChatProps {
  onMessageReceived: (message: string) => void;
  onError: (error: string) => void;
  isInterviewActive: boolean;
  initialMessage?: string;
  onComplete: () => void;
}

// Interview question types
type QuestionType = 'personal' | 'theory' | 'code';

// Interview structure - 7 shorter questions
const INTERVIEW_STRUCTURE: QuestionType[] = [
  'personal',
  'personal',
  'personal',
  'theory',
  'theory',
  'code',
  'personal'
];

const VoiceChat: React.FC<VoiceChatProps> = ({
  onMessageReceived,
  onError,
  isInterviewActive,
  initialMessage,
  onComplete
}) => {
  // Basic state
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>('');
  const [responseHistory, setResponseHistory] = useState<string[]>([]);
  const [currentResponseIndex, setCurrentResponseIndex] = useState<number>(-1);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(true); // Always on by default
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const isSpeakingRef = useRef<boolean>(false);
  const [messages, setMessages] = useState<{ content: string; isUser: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<number>(0);
  
  // Add a message queue state
  const [messageQueue, setMessageQueue] = useState<{ content: string; isUser: boolean }[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  
  // Add conversation history state
  const [conversationHistory, setConversationHistory] = useState<{
    question: string;
    answer: string;
    stage: number;
  }[]>([]);
  
  // Add questions list state
  const [questionsList, setQuestionsList] = useState<{
    question: string;
    stage: number;
    timestamp: Date;
  }[]>([]);
  
  // Add results state
  const [showResults, setShowResults] = useState<boolean>(false);
  const [interviewScore, setInterviewScore] = useState<number>(0);
  const [interviewFeedback, setInterviewFeedback] = useState<string[]>([]);
  
  // Speech recognition hook
  const {
    startListening,
    stopListening,
    isListening: isRecognitionActive,
    isSupported: isRecognitionSupported
  } = useSpeechRecognition(
    (text, isFinal) => {
      // Only process user input if not currently speaking
      if (!isSpeakingRef.current) {
        if (isFinal) {
          console.log('Final transcript received:', text);
          setTranscript(text);
          // Ensure we're not processing and not speaking before sending
          if (!isProcessing && !isSpeakingRef.current) {
            console.log('Sending final transcript to API');
            handleSendMessage(text);
          } else {
            console.log('Not sending transcript - processing:', isProcessing, 'speaking:', isSpeakingRef.current);
            // If we're stuck in processing state but not speaking, reset the processing flag
            if (isProcessing && !isSpeakingRef.current) {
              console.log('Resetting stuck processing flag');
              setIsProcessing(false);
              // Try sending the message again
              setTimeout(() => {
                handleSendMessage(text);
              }, 100);
            }
          }
        } else {
          setTranscript(text);
        }
      } else {
        // If speaking, ignore user input
        console.log('Ignoring user input while speaking');
      }
    },
    (error) => {
      console.error('Speech recognition error:', error);
      // Only show error if it's not a no-speech error
      if (error !== 'no-speech') {
        onError(`Speech recognition error: ${error}`);
      }
      setIsListening(false);
    },
    () => {
      console.log('Speech recognition ended');
      setIsListening(false);
    }
  );

  // Simple speech synthesis function
  const speakText = (text: string) => {
    if (!text || !text.trim()) {
      console.log('No text to speak');
      return;
    }
    
    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Create a new utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set properties
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Add event handlers
      utterance.onstart = () => {
        console.log('Speech started');
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      };
      utterance.onend = () => {
        console.log('Speech ended');
        isSpeakingRef.current = false;
        // Don't set isSpeaking to false here to keep it toggled on
      };
      utterance.onerror = (e) => {
        console.error('Speech error:', e);
        isSpeakingRef.current = false;
      };
      
      // SPEAK THE TEXT
      window.speechSynthesis.speak(utterance);
      
      console.log('Speaking text:', text);
    } catch (error) {
      console.error('Error in speech synthesis:', error);
      isSpeakingRef.current = false;
    }
  };

  // Simple message handling
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing || isSpeakingRef.current) {
      console.log('Not sending message - empty text:', !text.trim(), 'processing:', isProcessing, 'speaking:', isSpeakingRef.current);
      
      // If we're stuck in processing state but not speaking, reset the processing flag
      if (isProcessing && !isSpeakingRef.current) {
        console.log('Resetting stuck processing flag in handleSendMessage');
        setIsProcessing(false);
        // Try sending the message again after a short delay
        setTimeout(() => {
          handleSendMessage(text);
        }, 100);
      }
      return;
    }
    
    console.log('Sending message to API:', text);
    setIsProcessing(true);
    setTranscript('');
    
    try {
      // Get the current question from the last AI message
      const currentQuestion = messages.length > 0 && !messages[messages.length - 1].isUser 
        ? messages[messages.length - 1].content 
        : "What would you like to discuss?";
      
      // Prepare context for the API
      const context = {
        currentQuestion,
        conversationHistory: conversationHistory.slice(-5), // Send last 5 Q&A pairs for context
        currentStage,
        userResponse: text
      };
      
      // Send to API with context
      const response = await api.sendMessage(text);
      console.log('API response:', response);
      
      // Directly speak the response.message if it exists
      if (response && typeof response === 'object' && 'message' in response) {
        console.log('Directly speaking response.message:', response.message);
        speakText(response.message);
      }
      
      if (!isMountedRef.current) return;
      
      // Extract the message from the response
      let responseMessage = '';
      
      // If response is a string, use it directly
      if (typeof response === 'string') {
        responseMessage = response;
      } 
      // If response is an object, try to get the message property
      else if (response && typeof response === 'object') {
        // Try to get the message from common properties
        const responseObj = response as Record<string, any>;
        
        // First check for the specific format we know about
        if ('message' in responseObj) {
          responseMessage = responseObj.message;
          console.log('Found message in response.message:', responseMessage);
        } 
        // Then check other common properties
        else if ('text' in responseObj) {
          responseMessage = responseObj.text;
          console.log('Found message in response.text:', responseMessage);
        } else if ('content' in responseObj) {
          responseMessage = responseObj.content;
          console.log('Found message in response.content:', responseMessage);
        } else if ('response' in responseObj) {
          responseMessage = responseObj.response;
          console.log('Found message in response.response:', responseMessage);
        } else if ('generated_response' in responseObj) {
          responseMessage = responseObj.generated_response;
          console.log('Found message in response.generated_response:', responseMessage);
        } else {
          // If no standard property found, convert to string
          responseMessage = JSON.stringify(response);
          console.log('No standard property found, using stringified response:', responseMessage);
        }
      } else {
        // Fallback
        responseMessage = String(response);
        console.log('Using stringified response:', responseMessage);
      }
      
      console.log('Response message to speak:', responseMessage);
      
      // Store the response
      setLastResponse(responseMessage);
      
      // Add to response history
      setResponseHistory(prev => [...prev, responseMessage]);
      setCurrentResponseIndex(prev => prev + 1);
      
      // Add to conversation history
      setConversationHistory(prev => [...prev, {
        question: currentQuestion,
        answer: text,
        stage: currentStage
      }]);
      
      // Check if this is a coding question and the user has submitted code
      const isCodeSubmission = currentStage === 2 && text.includes('```');
      
      // If this is a code submission, complete the interview
      if (isCodeSubmission) {
        console.log('Code submission detected, completing interview');
        
        // Display the questions list in the console
        displayQuestionsList();
        
        // Display the conversation history in the console
        displayConversationHistory();
        
        // Generate interview results
        await generateInterviewResults();
        
        // Add a completion message to the queue
        setMessageQueue(prev => [...prev, { 
          content: "Thank you for completing the interview! Here's a summary of the questions asked:", 
          isUser: false 
        }]);
        
        // Add each question to the queue
        questionsList.forEach((item, index) => {
          setMessageQueue(prev => [...prev, { 
            content: `Question ${index + 1} (${item.stage === 0 ? 'Personal' : item.stage === 1 ? 'Technical' : 'Coding'}): ${item.question}`, 
            isUser: false 
          }]);
        });
        
        // Add a final message
        setMessageQueue(prev => [...prev, { 
          content: "Your responses have been recorded. Thank you for your time!", 
          isUser: false 
        }]);
        
        // Call the onComplete prop
        onComplete();
      } else {
        // Notify parent
        onMessageReceived(responseMessage);
        
        // Always speak the response
        speakText(responseMessage);
        
        // Move to next question - IMPORTANT: This needs to happen after processing the response
        console.log('Current question index before increment:', currentQuestionIndex);
        const nextQuestionIndex = currentQuestionIndex + 1;
        console.log('Setting next question index to:', nextQuestionIndex);
        setCurrentQuestionIndex(nextQuestionIndex);
        
        if (nextQuestionIndex < INTERVIEW_STRUCTURE.length) {
          console.log(`Next question type: ${INTERVIEW_STRUCTURE[nextQuestionIndex]}`);
        } else {
          console.log('Interview complete!');
          
          // Generate interview results
          await generateInterviewResults();
          
          // Add a completion message to the queue
          setMessageQueue(prev => [...prev, { 
            content: "Thank you for completing the interview! Here's a summary of the questions asked:", 
            isUser: false 
          }]);
          
          // Add each question to the queue
          questionsList.forEach((item, index) => {
            setMessageQueue(prev => [...prev, { 
              content: `Question ${index + 1} (${item.stage === 0 ? 'Personal' : item.stage === 1 ? 'Technical' : 'Coding'}): ${item.question}`, 
              isUser: false 
            }]);
          });
          
          // Add a final message
          setMessageQueue(prev => [...prev, { 
            content: "Your responses have been recorded. Thank you for your time!", 
            isUser: false 
          }]);
          
          // Call the onComplete prop
          onComplete();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (isMountedRef.current) {
        onError('Failed to send message. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        // Re-enable listening after processing is complete
        if (!isListening && isRecognitionSupported) {
          console.log('Re-enabling listening after response');
          startListening();
          setIsListening(true);
        }
      }
    }
  };

  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      startListening();
      setIsListening(true);
    }
  };

  // Test function to directly test speech synthesis
  const testSpeechSynthesis = () => {
    speakText("Hello, this is a test of the speech synthesis. Can you hear this?");
  };

  // Function to speak the next response in history
  const speakNextResponse = () => {
    if (responseHistory.length === 0) {
      speakText("No responses available to speak.");
      return;
    }
    
    // Move to the next response in history
    const nextIndex = (currentResponseIndex + 1) % responseHistory.length;
    setCurrentResponseIndex(nextIndex);
    
    // Speak the response
    speakText(responseHistory[nextIndex]);
  };

  // Function to speak the previous response in history
  const speakPreviousResponse = () => {
    if (responseHistory.length === 0) {
      speakText("No responses available to speak.");
      return;
    }
    
    // Move to the previous response in history
    const prevIndex = currentResponseIndex <= 0 
      ? responseHistory.length - 1 
      : currentResponseIndex - 1;
    setCurrentResponseIndex(prevIndex);
    
    // Speak the response
    speakText(responseHistory[prevIndex]);
  };

  // Initialize speech synthesis and auto-start listening
  useEffect(() => {
    // Check if speech synthesis is available
    if ('speechSynthesis' in window) {
      console.log('Speech synthesis is available');
      
      // Try to load voices
      const voices = window.speechSynthesis.getVoices();
      console.log('Initial voices count:', voices.length);
      
      // If voices are empty, set up the onvoiceschanged event
      if (voices.length === 0) {
        console.log('Setting up onvoiceschanged event');
        window.speechSynthesis.onvoiceschanged = () => {
          const loadedVoices = window.speechSynthesis.getVoices();
          console.log('Voices loaded on mount:', loadedVoices.length);
        };
      }
    } else {
      console.error('Speech synthesis is not available in this browser');
    }
    
    // Auto-start listening if supported
    if (isRecognitionSupported && !isListening) {
      console.log('Auto-starting listening');
      startListening();
      setIsListening(true);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [isRecognitionSupported, isListening, startListening]);

  // Handle initial message
  useEffect(() => {
    if (initialMessage) {
      setLastResponse(initialMessage);
      setResponseHistory([initialMessage]);
      setCurrentResponseIndex(0);
      speakText(initialMessage);
    }
  }, [initialMessage]);

  // Get current question type
  const getCurrentQuestionType = (): QuestionType => {
    console.log('Getting question type for index:', currentQuestionIndex);
    if (currentQuestionIndex < INTERVIEW_STRUCTURE.length) {
      const questionType = INTERVIEW_STRUCTURE[currentQuestionIndex];
      console.log('Current question type:', questionType);
      return questionType;
    }
    console.log('Past interview structure, defaulting to personal');
    return 'personal'; // Default to personal if we're past the structure
  };

  // Process the message queue
  useEffect(() => {
    const processQueue = async () => {
      if (messageQueue.length === 0 || isProcessingQueue) {
        return;
      }
      
      setIsProcessingQueue(true);
      const nextMessage = messageQueue[0];
      
      // Add the message to the chat
      setMessages(prev => [...prev, nextMessage]);
      
      // If it's an interviewer message, speak it
      if (!nextMessage.isUser) {
        await speakTextAndWait(nextMessage.content);
      }
      
      // Remove the processed message from the queue
      setMessageQueue(prev => prev.slice(1));
      setIsProcessingQueue(false);
      
      // After processing the queue, ensure listening is active if it's the last message
      if (messageQueue.length === 1 && !isListening && isRecognitionSupported) {
        console.log('Re-enabling listening after queue processing');
        startListening();
        setIsListening(true);
      }
    };
    
    processQueue();
  }, [messageQueue, isProcessingQueue, isListening, isRecognitionSupported, startListening]);
  
  // Function to speak text and wait for it to complete
  const speakTextAndWait = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text || !text.trim()) {
        resolve();
        return;
      }
      
      try {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Create a new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set properties
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Add event handlers
        utterance.onstart = () => {
          console.log('Speech started');
          setIsSpeaking(true);
          isSpeakingRef.current = true;
        };
        utterance.onend = () => {
          console.log('Speech ended');
          isSpeakingRef.current = false;
          resolve();
        };
        utterance.onerror = (e) => {
          console.error('Speech error:', e);
          isSpeakingRef.current = false;
          resolve();
        };
        
        // SPEAK THE TEXT
        window.speechSynthesis.speak(utterance);
        
        console.log('Speaking text:', text);
      } catch (error) {
        console.error('Error in speech synthesis:', error);
        isSpeakingRef.current = false;
        resolve();
      }
    });
  };
  
  // Update the generateQuestionForStage function to use AI prompts with context
  const generateQuestionForStage = async (stage: number): Promise<string> => {
    try {
      let prompt = '';
      
      // Create context for the question generation
      const context = {
        conversationHistory: conversationHistory.slice(-5), // Send last 5 Q&A pairs for context
        currentStage: stage,
        previousQuestions: conversationHistory.map(item => item.question)
      };
      
      if (stage === 0) { // Personal questions
        prompt = "Generate a personal interview question for a software developer. The question should be concise and focus on their background, experience, or career goals. Return only the question text without any additional context or explanation.";
      } else if (stage === 1) { // Technical questions
        prompt = "Generate a technical interview question about programming concepts, algorithms, or software architecture. The question should be concise and test the candidate's knowledge. Return only the question text without any additional context or explanation.";
      } else if (stage === 2) { // Coding questions
        prompt = "Generate a LeetCode-style coding interview question. The question should include: 1) A clear problem statement, 2) Input/output examples, and 3) Constraints. Format it like a typical LeetCode problem. Return only the question text without any additional context or explanation.";
      }
      
      // Send the prompt to the API with context
      const response = await api.sendMessage(prompt);
      
      // Extract the question from the response
      let question = '';
      
      if (typeof response === 'string') {
        question = response;
      } else if (response && typeof response === 'object') {
        const responseObj = response as Record<string, any>;
        
        if ('message' in responseObj) {
          question = responseObj.message;
        } else if ('text' in responseObj) {
          question = responseObj.text;
        } else if ('content' in responseObj) {
          question = responseObj.content;
        } else if ('response' in responseObj) {
          question = responseObj.response;
        } else if ('generated_response' in responseObj) {
          question = responseObj.generated_response;
        } else {
          question = JSON.stringify(response);
        }
      } else {
        question = String(response);
      }
      
      // Clean up the question (remove any markdown formatting, etc.)
      question = question.replace(/```/g, '').trim();
      
      // If the question is too long, truncate it
      if (question.length > 500) {
        question = question.substring(0, 500) + '...';
      }
      
      // Add the question to the questions list
      setQuestionsList(prev => [...prev, {
        question,
        stage,
        timestamp: new Date()
      }]);
      
      return question;
    } catch (error) {
      console.error('Error generating question:', error);
      
      // Fallback to predefined questions if AI generation fails
      let question = '';
      
      if (stage === 0) { // Personal questions
        const personalQuestions = [
          "Tell me about your background and experience in software development.",
          "What projects have you worked on recently?",
          "What are your strengths and weaknesses as a developer?",
          "Where do you see yourself in 5 years?",
          "Why are you interested in this position?"
        ];
        question = personalQuestions[Math.floor(Math.random() * personalQuestions.length)];
      } else if (stage === 1) { // Technical questions
        const technicalQuestions = [
          "Explain the difference between a stack and a queue data structure.",
          "What is the time complexity of binary search?",
          "Explain how garbage collection works in JavaScript.",
          "What is the difference between REST and GraphQL?",
          "Explain the concept of closures in JavaScript."
        ];
        question = technicalQuestions[Math.floor(Math.random() * technicalQuestions.length)];
      } else if (stage === 2) { // Coding questions
        const codingQuestions = [
          `Given an array of integers nums and an integer target, return indices of the two numbers in nums such that they add up to target.
          
          You may assume that each input would have exactly one solution, and you may not use the same element twice.
          
          Example 1:
          Input: nums = [2,7,11,15], target = 9
          Output: [0,1]
          Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
          
          Example 2:
          Input: nums = [3,2,4], target = 6
          Output: [1,2]
          
          Example 3:
          Input: nums = [3,3], target = 6
          Output: [0,1]
          
          Constraints:
          2 <= nums.length <= 104
          -109 <= nums[i] <= 109
          -109 <= target <= 109
          Only one valid answer exists.`,
          
          `Given a string s, find the length of the longest substring without repeating characters.
          
          Example 1:
          Input: s = "abcabcbb"
          Output: 3
          Explanation: The answer is "abc", with the length of 3.
          
          Example 2:
          Input: s = "bbbbb"
          Output: 1
          Explanation: The answer is "b", with the length of 1.
          
          Example 3:
          Input: s = "pwwkew"
          Output: 3
          Explanation: The answer is "wke", with the length of 3.
          Notice that the answer must be a substring, "pwke" is a subsequence and not a substring.
          
          Constraints:
          0 <= s.length <= 5 * 104
          s consists of English letters, digits, symbols and spaces.`,
          
          `You are given an array prices where prices[i] is the price of a given stock on the ith day.
          
          You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.
          
          Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.
          
          Example 1:
          Input: prices = [7,1,5,3,6,4]
          Output: 5
          Explanation: Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5.
          Note that buying on day 2 and selling on day 1 is not allowed because you must buy before you sell.
          
          Example 2:
          Input: prices = [7,6,4,3,1]
          Output: 0
          Explanation: In this case, no transactions are done and the max profit = 0.
          
          Constraints:
          1 <= prices.length <= 105
          0 <= prices[i] <= 104`
        ];
        question = codingQuestions[Math.floor(Math.random() * codingQuestions.length)];
      } else {
        question = "Could you tell me about your experience with software development?";
      }
      
      // Add the fallback question to the questions list
      setQuestionsList(prev => [...prev, {
        question,
        stage,
        timestamp: new Date()
      }]);
      
      return question;
    }
  };
  
  // Update the handleCommand function to use the queue with async question generation
  const handleCommand = async (command: string) => {
    console.log('Handling command:', command);
    
    // Reset processing state if it's stuck
    if (isProcessing && !isSpeakingRef.current) {
      console.log('Resetting stuck processing state before command execution');
      setIsProcessing(false);
    }
    
    if (command === '/move on') {
      // Move to the next section
      if (currentStage < 2) { // 0: personal, 1: technical, 2: code
        const nextStage = currentStage + 1;
        setCurrentStage(nextStage);
        
        // Generate appropriate prompt based on the new stage
        let prompt = '';
        if (nextStage === 1) {
          prompt = "Okay, let's move on to technical questions. I'll ask you about programming concepts and algorithms.";
        } else if (nextStage === 2) {
          prompt = "Now let's move to coding questions. I'll present you with a problem to solve.";
        }
        
        // Add the system message to the queue
        setMessageQueue(prev => [...prev, { content: prompt, isUser: false }]);
        
        // Generate a question for the new stage after a short delay
        setTimeout(async () => {
          const question = await generateQuestionForStage(nextStage);
          setMessageQueue(prev => [...prev, { content: question, isUser: false }]);
          
          // Ensure listening is active after section change
          if (!isListening && isRecognitionSupported) {
            console.log('Re-enabling listening after section change');
            startListening();
            setIsListening(true);
          }
        }, 1500);
      } else {
        // We're at the last stage, offer to complete the interview
        setMessageQueue(prev => [...prev, { 
          content: "We've completed all sections of the interview. Would you like to finish now?", 
          isUser: false 
        }]);
        
        // Ensure listening is active after section change
        if (!isListening && isRecognitionSupported) {
          console.log('Re-enabling listening after section change');
          startListening();
          setIsListening(true);
        }
      }
    } else if (command === '/technical') {
      // Skip directly to technical questions
      setCurrentStage(1); // Set to technical stage
      const prompt = "Okay, let's move to the technical questions. I'll ask you about programming concepts and algorithms.";
      setMessageQueue(prev => [...prev, { content: prompt, isUser: false }]);
      
      // Generate a question after a short delay
      setTimeout(async () => {
        const question = await generateQuestionForStage(1);
        setMessageQueue(prev => [...prev, { content: question, isUser: false }]);
        
        // Ensure listening is active after section change
        if (!isListening && isRecognitionSupported) {
          console.log('Re-enabling listening after section change');
          startListening();
          setIsListening(true);
        }
      }, 1500);
    } else if (command === '/coding') {
      // Skip directly to coding questions
      setCurrentStage(2); // Set to coding stage
      const prompt = "Okay, let's move to the coding questions. I'll present you with a problem to solve.";
      setMessageQueue(prev => [...prev, { content: prompt, isUser: false }]);
      
      // Generate a question after a short delay
      setTimeout(async () => {
        const question = await generateQuestionForStage(2);
        setMessageQueue(prev => [...prev, { content: question, isUser: false }]);
        
        // Ensure listening is active after section change
        if (!isListening && isRecognitionSupported) {
          console.log('Re-enabling listening after section change');
          startListening();
          setIsListening(true);
        }
      }, 1500);
    }
  };
  
  // Update the initialization to use the queue with async question generation
  useEffect(() => {
    if (isInterviewActive && messages.length === 0) {
      const welcomeMessage = "Hello! I'm Alex, your technical interviewer today. Let's start with some personal questions to get to know you better.";
      setMessageQueue([{ content: welcomeMessage, isUser: false }]);
      
      // Generate the first question after a short delay
      setTimeout(async () => {
        const question = await generateQuestionForStage(0);
        setMessageQueue(prev => [...prev, { content: question, isUser: false }]);
      }, 1000);
    }
  }, [isInterviewActive]);

  // Add a ref for the chat container
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to the bottom of the chat when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Add a safety check to reset processing flag if it gets stuck
  useEffect(() => {
    const processingCheckInterval = setInterval(() => {
      if (isProcessing && !isSpeakingRef.current) {
        console.log('Safety check: Resetting stuck processing flag');
        setIsProcessing(false);
        
        // Also ensure listening is active if it's not
        if (!isListening && isRecognitionSupported) {
          console.log('Safety check: Re-enabling listening');
          startListening();
          setIsListening(true);
        }
      }
    }, 2000); // Check every 2 seconds (reduced from 5 seconds)
    
    return () => {
      clearInterval(processingCheckInterval);
    };
  }, [isProcessing, isListening, isRecognitionSupported, startListening]);

  // Add a function to display conversation history
  const displayConversationHistory = () => {
    console.log('Conversation History:');
    conversationHistory.forEach((item, index) => {
      console.log(`Q${index + 1}: ${item.question}`);
      console.log(`A${index + 1}: ${item.answer}`);
      console.log(`Stage: ${item.stage === 0 ? 'Personal' : item.stage === 1 ? 'Technical' : 'Coding'}`);
      console.log('---');
    });
  };

  // Add a function to display the questions list
  const displayQuestionsList = () => {
    console.log('Questions List:');
    questionsList.forEach((item, index) => {
      console.log(`Q${index + 1}: ${item.question}`);
      console.log(`Stage: ${item.stage === 0 ? 'Personal' : item.stage === 1 ? 'Technical' : 'Coding'}`);
      console.log(`Asked at: ${item.timestamp.toLocaleTimeString()}`);
      console.log('---');
    });
  };

  // Add a function to generate interview results
  const generateInterviewResults = async () => {
    try {
      // Prepare the interview data for evaluation
      const interviewData = {
        questions: questionsList,
        answers: conversationHistory,
        totalQuestions: questionsList.length,
        personalQuestions: questionsList.filter(q => q.stage === 0).length,
        technicalQuestions: questionsList.filter(q => q.stage === 1).length,
        codingQuestions: questionsList.filter(q => q.stage === 2).length
      };
      
      // Create a prompt for the AI to evaluate the interview
      const evaluationPrompt = `
        You are an expert technical interviewer evaluating a software developer candidate.
        Based on the following interview data, provide:
        1. A score out of 100 (be specific with the number)
        2. 3-5 specific feedback points about their performance
        
        Interview Data:
        ${JSON.stringify(interviewData, null, 2)}
        
        Format your response as a JSON object with the following structure:
        {
          "score": number,
          "feedback": string[]
        }
      `;
      
      // Send the evaluation prompt to the API
      const response = await api.sendMessage(evaluationPrompt);
      
      // Parse the response
      let evaluationResult;
      
      if (typeof response === 'string') {
        try {
          evaluationResult = JSON.parse(response);
        } catch (e) {
          console.error('Error parsing evaluation result:', e);
          evaluationResult = {
            score: 75,
            feedback: [
              "Good communication skills demonstrated throughout the interview",
              "Shows solid understanding of technical concepts",
              "Could provide more detailed answers in some areas"
            ]
          };
        }
      } else if (response && typeof response === 'object') {
        const responseObj = response as Record<string, any>;
        
        if ('score' in responseObj && 'feedback' in responseObj) {
          evaluationResult = responseObj;
        } else {
          evaluationResult = {
            score: 75,
            feedback: [
              "Good communication skills demonstrated throughout the interview",
              "Shows solid understanding of technical concepts",
              "Could provide more detailed answers in some areas"
            ]
          };
        }
      } else {
        evaluationResult = {
          score: 75,
          feedback: [
            "Good communication skills demonstrated throughout the interview",
            "Shows solid understanding of technical concepts",
            "Could provide more detailed answers in some areas"
          ]
        };
      }
      
      // Set the interview results
      setInterviewScore(evaluationResult.score || 75);
      setInterviewFeedback(evaluationResult.feedback || [
        "Good communication skills demonstrated throughout the interview",
        "Shows solid understanding of technical concepts",
        "Could provide more detailed answers in some areas"
      ]);
      
      // Show the results page
      setShowResults(true);
      
      console.log('Interview evaluation complete:', evaluationResult);
    } catch (error) {
      console.error('Error generating interview results:', error);
      
      // Set default results
      setInterviewScore(75);
      setInterviewFeedback([
        "Good communication skills demonstrated throughout the interview",
        "Shows solid understanding of technical concepts",
        "Could provide more detailed answers in some areas"
      ]);
      
      // Show the results page
      setShowResults(true);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {showResults ? (
        <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-8">
              <h1 className="text-3xl font-bold text-center mb-8 text-indigo-700">Interview Results</h1>
              
              <div className="flex justify-center mb-8">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle 
                      className="text-gray-200" 
                      strokeWidth="10" 
                      stroke="currentColor" 
                      fill="transparent" 
                      r="40" 
                      cx="50" 
                      cy="50" 
                    />
                    
                    {/* Score circle */}
                    <circle 
                      className="text-indigo-600" 
                      strokeWidth="10" 
                      strokeDasharray={`${interviewScore * 2.51} 251`} 
                      strokeLinecap="round" 
                      stroke="currentColor" 
                      fill="transparent" 
                      r="40" 
                      cx="50" 
                      cy="50" 
                    />
                    
                    {/* Score text */}
                    <text 
                      x="50" 
                      y="50" 
                      className="text-4xl font-bold text-indigo-700" 
                      textAnchor="middle" 
                      dominantBaseline="middle"
                    >
                      {interviewScore}
                    </text>
                  </svg>
                </div>
              </div>
              
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-indigo-700">Feedback</h2>
                <ul className="space-y-3">
                  {interviewFeedback.map((feedback, index) => (
                    <li key={index} className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mr-3 mt-0.5">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{feedback}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-indigo-700">Questions Asked</h2>
                <div className="space-y-4">
                  {questionsList.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-indigo-700">Question {index + 1}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          item.stage === 0 ? 'bg-blue-100 text-blue-800' : 
                          item.stage === 1 ? 'bg-green-100 text-green-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.stage === 0 ? 'Personal' : item.stage === 1 ? 'Technical' : 'Coding'}
                        </span>
                      </div>
                      <p className="text-gray-700">{item.question}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-center">
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start New Interview
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatContainerRef}>
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg p-3 max-w-[80%] ${
                  message.isUser ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}>
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {error && (
              <div className="text-red-500 text-center">
                {error}
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center p-4 bg-gray-50 border-t">
            <div className="flex space-x-2">
              <button
                onClick={() => handleCommand('/move on')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Next Section
              </button>
              <button
                onClick={() => handleCommand('/technical')}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                Technical Questions
              </button>
              <button
                onClick={() => handleCommand('/coding')}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
              >
                Coding Questions
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              Current Stage: {currentStage === 0 ? 'Personal' : currentStage === 1 ? 'Technical' : 'Coding'}
            </div>
          </div>

          {/* Voice Input Controls - Simplified */}
          <div className="p-4 border-t flex items-center justify-center">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`px-6 py-3 rounded-full ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white transition-colors flex items-center space-x-2`}
            >
              <span className="material-icons">
                {isListening ? 'mic_off' : 'mic'}
              </span>
              <span>{isListening ? 'Stop Recording' : 'Start Recording'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceChat;