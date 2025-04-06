'use client';

import { useState, useEffect, useRef } from 'react';
import { api, Question, Evaluation, ChatResponse } from '@/services/api';
import { executeCode, CodeResult } from '@/services/codeExecutor';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceChat from '@/components/VoiceChat';

const SUPPORTED_LANGUAGES = [
  { id: 'python', name: 'Python' },
  { id: 'cpp', name: 'C++' },
  { id: 'javascript', name: 'JavaScript' },
];

const DEFAULT_CODE = {
  python: '# Write your Python solution here\n\ndef solution():\n    pass\n',
  cpp: '// Write your C++ solution here\n\n#include <iostream>\n\nint main() {\n    // Your code here\n    return 0;\n}\n',
  javascript: '// Write your JavaScript solution here\n\nfunction solution() {\n    // Your code here\n}\n',
};

// Function templates for different languages
const FUNCTION_TEMPLATES = {
  python: (signature: string, parameters: string[], returnType: string, problemStatement: string) => {
    // Check if this is a class-based problem
    if (signature.includes('.')) {
      const [className, methodName] = signature.split('.');
      return `"""
${problemStatement}

Problem Statement:
${problemStatement}

Function Signature:
${signature}

Parameters:
${parameters.map(p => `- ${p}: Description of ${p}`).join('\n')}

Return Type:
${returnType}
"""

class ${className}:
    def __init__(self):
        """
        Initialize the ${className} class.
        """
        pass
        
    def ${methodName}(${parameters.join(', ')}):
        """
        ${methodName} method of ${className} class.
        
        Parameters:
        ${parameters.map(p => `    ${p}: The ${p} parameter`).join('\n')}
        
        Returns:
        ${returnType}: The result of the operation
        """
        pass

# Example usage:
# cache = ${className}()
# result = cache.${methodName}(${parameters.map(p => 'value').join(', ')})
# print(result)  # Expected output based on the problem

# Test cases:
# test1 = ${className}()
# assert test1.${methodName}(${parameters.map(p => 'value').join(', ')}) == expected_output, "Test case 1 failed"

# TODO: Implement the solution
`;
    } else {
      return `"""
${problemStatement}

Problem Statement:
${problemStatement}

Function Signature:
${signature}

Parameters:
${parameters.map(p => `- ${p}: Description of ${p}`).join('\n')}

Return Type:
${returnType}
"""

def ${signature}:
    """
    ${parameters.length > 0 ? `Parameters:\n${parameters.map(p => `    ${p}: The ${p} parameter`).join('\n')}` : 'No parameters'}
    
    Returns:
    ${returnType}: The result of the operation
    """
    pass

# Example usage:
# result = ${signature.split('(')[0]}(${parameters.map(p => 'value').join(', ')})
# print(result)  # Expected output based on the problem

# Test cases:
# assert ${signature.split('(')[0]}(${parameters.map(p => 'value').join(', ')}) == expected_output, "Test case 1 failed"

# TODO: Implement the solution
`;
    }
  },
  cpp: (signature: string, parameters: string[], returnType: string, problemStatement: string) => {
    // Check if this is a class-based problem
    if (signature.includes('.')) {
      const [className, methodName] = signature.split('.');
      return `/**
 * ${problemStatement}
 * 
 * Problem Statement:
 * ${problemStatement}
 * 
 * Function Signature:
 * ${signature}
 * 
 * Parameters:
 * ${parameters.map(p => ` * - ${p}: Description of ${p}`).join('\n')}
 * 
 * Return Type:
 * ${returnType}
 */

class ${className} {
public:
    ${className}() {
        // Initialize the ${className} class
    }
    
    ${returnType} ${methodName}(${parameters.map(p => `int ${p}`).join(', ')}) {
        /**
         * ${methodName} method of ${className} class
         * 
         * Parameters:
         * ${parameters.map(p => `    ${p}: The ${p} parameter`).join('\n')}
         * 
         * Returns:
         * ${returnType}: The result of the operation
         */
    }
};

// Example usage:
// ${className} cache;
// ${returnType} result = cache.${methodName}(${parameters.map(p => 'value').join(', ')});
// cout << result << endl;  // Expected output based on the problem

// Test cases:
// ${className} test1;
// assert(test1.${methodName}(${parameters.map(p => 'value').join(', ')}) == expected_output);

// TODO: Implement the solution
`;
    } else {
      return `/**
 * ${problemStatement}
 * 
 * Problem Statement:
 * ${problemStatement}
 * 
 * Function Signature:
 * ${signature}
 * 
 * Parameters:
 * ${parameters.map(p => ` * - ${p}: Description of ${p}`).join('\n')}
 * 
 * Return Type:
 * ${returnType}
 */

/**
 * ${parameters.length > 0 ? `Parameters:\n${parameters.map(p => ` * @param ${p} The ${p} parameter`).join('\n')}` : ' * No parameters'}
 * @return ${returnType} The result of the operation
 */
${returnType} ${signature} {
    // TODO: Implement the solution
}

// Example usage:
// ${returnType} result = ${signature.split('(')[0]}(${parameters.map(p => 'value').join(', ')});
// cout << result << endl;  // Expected output based on the problem

// Test cases:
// assert(${signature.split('(')[0]}(${parameters.map(p => 'value').join(', ')}) == expected_output);

// TODO: Implement the solution
`;
    }
  },
  javascript: (signature: string, parameters: string[], returnType: string, problemStatement: string) => {
    // Check if this is a class-based problem
    if (signature.includes('.')) {
      const [className, methodName] = signature.split('.');
      return `/**
 * ${problemStatement}
 * 
 * Problem Statement:
 * ${problemStatement}
 * 
 * Function Signature:
 * ${signature}
 * 
 * Parameters:
 * ${parameters.map(p => ` * - ${p}: Description of ${p}`).join('\n')}
 * 
 * Return Type:
 * ${returnType}
 */

class ${className} {
    constructor() {
        // Initialize the ${className} class
    }
    
    ${methodName}(${parameters.join(', ')}) {
        /**
         * ${methodName} method of ${className} class
         * 
         * @param {${parameters.map(p => 'any').join('} @param {any} ')}}
         * @returns {${returnType}} The result of the operation
         */
    }
}

// Example usage:
// const cache = new ${className}();
// const result = cache.${methodName}(${parameters.map(p => 'value').join(', ')});
// console.log(result);  // Expected output based on the problem

// Test cases:
// const test1 = new ${className}();
// console.assert(test1.${methodName}(${parameters.map(p => 'value').join(', ')}) === expected_output, "Test case 1 failed");

// TODO: Implement the solution
`;
    } else {
      return `/**
 * ${problemStatement}
 * 
 * Problem Statement:
 * ${problemStatement}
 * 
 * Function Signature:
 * ${signature}
 * 
 * Parameters:
 * ${parameters.map(p => ` * - ${p}: Description of ${p}`).join('\n')}
 * 
 * Return Type:
 * ${returnType}
 */

/**
 * ${parameters.length > 0 ? `@param {${parameters.map(p => 'any').join('} @param {any} ')}}` : 'No parameters'}
 * @returns {${returnType}} The result of the operation
 */
function ${signature} {
    // TODO: Implement the solution
}

// Example usage:
// const result = ${signature.split('(')[0]}(${parameters.map(p => 'value').join(', ')});
// console.log(result);  // Expected output based on the problem

// Test cases:
// console.assert(${signature.split('(')[0]}(${parameters.map(p => 'value').join(', ')}) === expected_output, "Test case 1 failed");
`;
    }
  },
};

interface ChatMessage {
  type: 'user' | 'interviewer' | 'system';
  content: string;
}

interface InterviewState {
  stage: 'initial' | 'introduction' | 'background' | 'technical_discussion' | 'coding' | 'system_design' | 'questions' | 'complete';
  currentTopic?: string;
  lastResponseQuality: 'good' | 'neutral' | 'poor';
  interviewStyle: 'standard' | 'challenging' | 'supportive';
}

// Add the extractFunctionSignature function
const extractFunctionSignature = (text: string): { signature: string, parameters: string[], returnType: string } => {
  // Default values
  let signature = 'def solution()';
  let parameters: string[] = [];
  let returnType = 'any';
  
  // Try to extract function signature from the text
  const signatureMatch = text.match(/Function Signature:\s*```\s*([^`]+)\s*```/);
  if (signatureMatch && signatureMatch[1]) {
    signature = signatureMatch[1].trim();
    
    // Extract parameters
    const paramsMatch = text.match(/Parameters:\s*([\s\S]*?)(?:\n\n|Return Type:|$)/);
    if (paramsMatch && paramsMatch[1]) {
      parameters = paramsMatch[1]
        .split('\n')
        .map(line => line.replace(/^-\s*`|`$/g, '').trim())
        .filter(Boolean);
    }
    
    // Extract return type
    const returnMatch = text.match(/Return Type:\s*`([^`]+)`/);
    if (returnMatch && returnMatch[1]) {
      returnType = returnMatch[1].trim();
    }
  }
  
  return { signature, parameters, returnType };
};

// Add the generateCodeTemplate function
const generateCodeTemplate = (signature: string, language: string): string => {
  // Default template
  let template = '';
  
  // Generate template based on language
  switch (language.toLowerCase()) {
    case 'python':
      template = `${signature}:\n    # Your code here\n    pass`;
      break;
    case 'javascript':
      template = `${signature} {\n    // Your code here\n    return null;\n}`;
      break;
    case 'java':
      template = `public ${signature} {\n    // Your code here\n    return null;\n}`;
      break;
    default:
      template = `${signature}:\n    # Your code here\n    pass`;
  }
  
  return template;
};

export default function InterviewPage() {
  const [jobRole, setJobRole] = useState('');
  const [showJobRoleModal, setShowJobRoleModal] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState(DEFAULT_CODE.python);
  const [language, setLanguage] = useState('python');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>({
    stage: 'initial',
    lastResponseQuality: 'neutral',
    interviewStyle: 'standard'
  });
  const [isThinking, setIsThinking] = useState(false);
  const [codeInputs, setCodeInputs] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    // Reset interview context when component mounts
    api.resetContext();
  }, []);

  useEffect(() => {
    // Scroll to bottom whenever chat history updates
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Update code when language changes or when a new question is received
  useEffect(() => {
    if (question?.metadata?.functionSignature) {
      console.log("Setting up code editor with function signature:", question.metadata.functionSignature);
      const signature = question.metadata.functionSignature;
      const parameters = question.metadata.parameters || [];
      const returnType = question.metadata.returnType || 'any';
      const problemStatement = question.question || '';
      
      // Create a template based on the function signature
      const template = FUNCTION_TEMPLATES[language as keyof typeof FUNCTION_TEMPLATES](
        signature, 
        parameters,
        returnType,
        problemStatement
      );
      
      console.log("Generated template:", template);
      setCode(template);
      
      // Set up inputs based on parameters
      setCodeInputs(parameters);
      setInputValues(parameters.map(() => ''));
    } else {
      // Use default code if no function signature is available
      setCode(DEFAULT_CODE[language as keyof typeof DEFAULT_CODE]);
      setCodeInputs([]);
      setInputValues([]);
    }
  }, [language, question]);

  const handleJobRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobRole.trim()) return;
    
    setShowJobRoleModal(false);
    setIsThinking(true);
    try {
      const response = await api.sendMessage(jobRole);
      setChatHistory([{ type: 'interviewer', content: response.message }]);
      setInterviewState(prev => ({ ...prev, stage: 'introduction' }));
    } catch (err) {
      setError('Failed to start interview. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleSendMessage = async (message?: string) => {
    // If message is provided (from voice chat), use it, otherwise use the chatMessage state
    const messageToSend = message || chatMessage;
    if (!messageToSend.trim()) return;

    // Check if this is a response to the completion message
    const lastMessage = chatHistory[chatHistory.length - 1]?.content;
    if (lastMessage?.includes("Would you like to finish now?")) {
      // Complete the interview
      setInterviewState(prev => ({ ...prev, stage: 'complete' }));
      setShowResults(true);
      return;
    }

    try {
      setIsThinking(true);
      setError(null);
      
      // Add user message to chat
      const userMessage = messageToSend.trim();
      setChatHistory(prev => [...prev, { type: 'user', content: userMessage }]);
      
      // Only clear the input field if we're in text mode
      if (!message) {
        setChatMessage('');
      }

      // Get interviewer's response
      const response = await api.sendMessage(userMessage);
      
      console.log('Interview page received API response:', response);
      
      // Update interview state based on response
      setInterviewState(prev => {
        let newState = { ...prev };
        
        // Progress interview stages based on keywords and context
        if (prev.stage === 'introduction' && userMessage.toLowerCase().includes('experience')) {
          newState.stage = 'background';
        } else if (prev.stage === 'background' && response.message.includes('technical question')) {
          newState.stage = 'technical_discussion';
        } else if (prev.stage === 'technical_discussion' && response.message.includes('coding challenge')) {
          newState.stage = 'coding';
        }

        // Update response quality based on keywords in the interviewer's response
        if (response.message.includes('excellent') || response.message.includes('great answer')) {
          newState.lastResponseQuality = 'good';
        } else if (response.message.includes('could improve') || response.message.includes('consider')) {
          newState.lastResponseQuality = 'neutral';
        } else if (response.message.includes('let me help') || response.message.includes('hint')) {
          newState.lastResponseQuality = 'poor';
        }
        
        return newState;
      });
      
      // Add interviewer's response to chat
      setChatHistory(prev => [...prev, { type: 'interviewer', content: response.message }]);
      
      // Add feedback message based on response quality
      const feedbackMessage = {
        type: 'system' as const,
        content: getFeedbackMessage(interviewState.lastResponseQuality)
      };
      setChatHistory(prev => [...prev, feedbackMessage]);
      
      // Check if we need to generate a coding question
      if (response.message.includes('coding challenge') || response.message.includes('algorithm problem')) {
        handleGenerateQuestion();
      }
      
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  // Helper function to generate feedback messages
  const getFeedbackMessage = (quality: 'good' | 'neutral' | 'poor'): string => {
    switch (quality) {
      case 'good':
        return "Great job! Your answer was clear and well-structured. Let's move on to the next question.";
      case 'neutral':
        return "Good effort! Your answer was on the right track, but could be more detailed. Let's continue.";
      case 'poor':
        return "Let me help you improve your answer. Try to be more specific and provide concrete examples.";
      default:
        return "Let's move on to the next question.";
    }
  };

  const handleEvaluateSolution = async () => {
    if (!question || !code) return;

    try {
      setIsThinking(true);
      setError(null);
      
      // First, execute the code
      const execResult = await executeCode(code, language);
      setCodeResult(execResult);

      // Then evaluate the solution
      const result = await api.evaluateSolution(code, question.question);
      setEvaluation(result);
      
      // Add code execution result and evaluation to chat
      const executionMessage = execResult.error 
        ? `Your code produced an error:\n\`\`\`\n${execResult.error}\n\`\`\``
        : `Code output:\n\`\`\`\n${execResult.output}\n\`\`\``;
      
      setChatHistory(prev => [
        ...prev, 
        { type: 'system', content: executionMessage },
        { type: 'interviewer', content: result.feedback }
      ]);

      // Update interview state based on evaluation
      setInterviewState(prev => ({
        ...prev,
        lastResponseQuality: result.feedback.includes('great') ? 'good' : 
                           result.feedback.includes('improve') ? 'poor' : 'neutral'
      }));
    } catch (err) {
      setError('Failed to evaluate solution. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleCodeChange = async (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
  };

  const handleRunCode = async () => {
    if (!code) return;
    
    try {
      setIsThinking(true);
      setError(null);
      
      // Check if the code contains input() or similar functions
      const hasInputFunction = code.includes('input(') || 
                              code.includes('scanf(') || 
                              code.includes('readline(') ||
                              code.includes('prompt(');
      
      // If the code has input functions but no inputs are provided, show a helpful message
      if (hasInputFunction && (!inputValues || inputValues.length === 0 || inputValues.every(v => !v))) {
        setCodeResult({
          output: '',
          error: 'This code requires input values. Please provide test inputs in the fields above.',
          inputs: []
        });
        setIsThinking(false);
        return;
      }
      
      // Execute the code with inputs using the new code executor
      const result = await executeCode(code, language, inputValues);
      setCodeResult(result);
    } catch (err) {
      setError('Failed to execute code. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  // Update the getAISuggestions function to use the new API method
  const getAISuggestions = async (code: string) => {
    try {
      setIsThinking(true);
      
      // Get the current cursor position from the editor instance
      const position = editorInstance?.getPosition();
      const cursorLine = position?.lineNumber || 0;
      
      // Extract the current line and context
      const lines = code.split('\n');
      const currentLineIndex = cursorLine - 1; // Convert to 0-based index
      
      if (currentLineIndex < 0 || currentLineIndex >= lines.length) return;
      
      const currentLine = lines[currentLineIndex];
      const contextBefore = lines.slice(Math.max(0, currentLineIndex - 5), currentLineIndex).join('\n');
      const contextAfter = lines.slice(currentLineIndex + 1, Math.min(lines.length, currentLineIndex + 5)).join('\n');
      
      // Get suggestions from the API
      const suggestions = await api.getCodeSuggestions(
        code,
        currentLine,
        contextBefore,
        contextAfter,
        question?.question || 'No problem statement available'
      );
      
      // Add the suggestions to the chat
      setChatHistory(prev => [...prev, { type: 'system', content: suggestions }]);
    } catch (err) {
      console.error('Failed to get AI suggestions:', err);
      setError('Failed to get AI suggestions. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  // Handle voice message received
  const handleVoiceMessageReceived = (message: string) => {
    console.log('Voice message received:', message);
    
    // Only add non-empty messages
    if (!message.trim()) return;
    
    // Check if this is a duplicate of the last message
    const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
    if (lastMessage && lastMessage.type === 'user' && lastMessage.content === message) {
      console.log('Duplicate message detected, skipping');
      return;
    }
    
    // Add the message to chat history
    setChatHistory(prev => [...prev, { type: 'user', content: message }]);
    
    // Send the message to the API
    handleSendMessage(message);
  };
  
  // Handle generating a new question
  const handleGenerateQuestion = async () => {
    try {
      setIsThinking(true);
      setError(null);
      
      // Send a special command to generate a question
      const response = await api.sendMessage('/123');
      
      // Update the question state
      setQuestion({
        question: response.message,
        metadata: {
          difficulty: 'medium',
          jobRole: jobRole,
          functionSignature: extractFunctionSignature(response.message).signature,
          parameters: extractFunctionSignature(response.message).parameters,
          returnType: extractFunctionSignature(response.message).returnType
        }
      });
      
      // Add the question to chat history
      setChatHistory(prev => [...prev, { type: 'system', content: 'New question generated' }]);
      
      // Generate initial code template if there's a function signature
      if (response.message.includes('Function Signature')) {
        const signature = extractFunctionSignature(response.message).signature;
        if (signature) {
          const template = generateCodeTemplate(signature, language);
          setCode(template);
        }
      }
    } catch (err) {
      console.error('Error generating question:', err);
      setError('Failed to generate question. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  if (showJobRoleModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Welcome to the Technical Interview</h2>
          <p className="text-gray-600 mb-6">Please enter the job role you're applying for to begin the interview.</p>
          <form onSubmit={handleJobRoleSubmit} className="space-y-4">
            <input
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g., Software Engineer, AI Engineer, Frontend Developer"
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={!jobRole.trim()}
            >
              Start Interview
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Technical Interview</h1>
          <div className="text-sm text-gray-500">
            Stage: {interviewState.stage.replace('_', ' ').charAt(0).toUpperCase() + interviewState.stage.slice(1)}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Code Editor */}
          <div className="space-y-6">
            {question && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Question</h2>
                <div className="prose max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {question.question}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Your Solution</h2>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="h-[400px] border rounded-md overflow-hidden mb-4">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  language={language}
                  value={code}
                  onChange={handleCodeChange}
                  theme="vs-dark"
                  onMount={(editor) => setEditorInstance(editor)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    tabSize: 4,
                    insertSpaces: true,
                  }}
                />
              </div>
              
              {/* Code Inputs Section */}
              {codeInputs.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Test Inputs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {codeInputs.map((input, index) => (
                      <div key={index} className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">{input}</label>
                        <input
                          type="text"
                          value={inputValues[index]}
                          onChange={(e) => {
                            const newValues = [...inputValues];
                            newValues[index] = e.target.value;
                            setInputValues(newValues);
                          }}
                          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                          placeholder={`Enter value for ${input}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Code Output Section */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Code Output</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => getAISuggestions(code)}
                      disabled={!code || isThinking}
                      className="bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 text-sm"
                    >
                      {isThinking ? 'Getting Suggestions...' : 'Get AI Suggestions'}
                    </button>
                    <button
                      onClick={handleRunCode}
                      disabled={!code || isThinking}
                      className="bg-green-600 text-white py-1 px-3 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 text-sm"
                    >
                      {isThinking ? 'Running...' : 'Run Code'}
                    </button>
                  
                  </div>
                </div>
                
                {codeResult ? (
                  <div className={`p-4 rounded-md ${codeResult.error ? 'bg-red-50' : 'bg-green-50'} border ${codeResult.error ? 'border-red-200' : 'border-green-200'}`}>
                    <div className="flex items-center mb-2">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${codeResult.error ? 'bg-red-500' : 'bg-green-500'}`}></span>
                      <span className="font-medium">{codeResult.error ? 'Error' : 'Success'}</span>
                    </div>
                    
                    {codeResult.inputs && codeResult.inputs.length > 0 && (
                      <div className="mb-2 text-sm">
                        <span className="font-medium">Inputs:</span>
                        <div className="mt-1 bg-gray-100 p-2 rounded border border-gray-200">
                          {codeResult.inputs.map((input, index) => (
                            <div key={index} className="font-mono">{input}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
                      {codeResult.error || codeResult.output || 'No output'}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 rounded-md bg-gray-50 border border-gray-200">
                    <p className="text-sm text-gray-500">Run your code to see the output here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Chat or Voice Chat */}
          <div className="bg-white p-6 rounded-lg shadow h-[calc(100vh-8rem)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Interview Chat</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsVoiceMode(!isVoiceMode)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    isVoiceMode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {isVoiceMode ? 'Voice Mode' : 'Text Mode'}
                </button>
              </div>
            </div>
            
            {isVoiceMode ? (
              <VoiceChat
                onMessageReceived={handleVoiceMessageReceived}
                onError={setError}
                isInterviewActive={interviewState.stage !== 'complete'}
                initialMessage={chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].content : undefined}
                onComplete={() => {
                  setInterviewState(prev => ({ ...prev, stage: 'complete' }));
                  setShowResults(true);
                }}
              />
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {chatHistory.map((chat, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        chat.type === 'interviewer'
                          ? 'bg-gray-50'
                          : chat.type === 'system'
                          ? 'bg-blue-50'
                          : 'bg-indigo-50 ml-4'
                      }`}
                    >
                      <p className="text-xs text-gray-500 mb-1">
                        {chat.type === 'interviewer' ? 'Interviewer' : 
                         chat.type === 'system' ? 'System' : 'You'}
                      </p>
                      <div className="prose max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {chat.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isThinking && handleSendMessage()}
                    disabled={isThinking}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                    placeholder={isThinking ? 'Please wait...' : 'Type your message...'}
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!chatMessage.trim() || isThinking}
                    className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isThinking ? 'Thinking...' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 