import axios from 'axios';
import { executeCode, CodeResult } from './codeExecutor';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.data);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface Question {
  question: string;
  metadata: {
    difficulty: string;
    jobRole: string;
    functionSignature?: string;
    parameters?: string[];
    returnType?: string;
  };
}

export interface Evaluation {
  feedback: string;
}

export interface ChatResponse {
  message: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Define the interview stages as a type
type InterviewStage = 'initial' | 'introduction' | 'background' | 'technical_discussion' | 'coding' | 'system_design' | 'questions' | 'complete';

// Update the InterviewContext interface to use the InterviewStage type
interface InterviewContext {
  jobRole: string;
  candidateResponses: Array<{
    question: string;
    response: string;
    score: number;
    followUpResponses: Array<{
      question: string;
      response: string;
      quality: 'good' | 'neutral' | 'poor';
    }>;
  }>;
  currentTopic?: string;
  overallScore: number;
  technicalSkills: {
    [key: string]: {
      score: number;
      notes: string[];
    };
  };
  softSkills: {
    communicationScore: number;
    problemSolvingScore: number;
    clarificationQuality: number;
    explanationClarity: number;
  };
  strengths: string[];
  areasToImprove: string[];
  interviewNotes: string[];
  isInterviewComplete: boolean;
  stage: InterviewStage;
  questionsAsked: number;
  currentQuestionDepth: number;
  hasAskedClarification: boolean;
  lastResponseQuality: 'good' | 'neutral' | 'poor';
  interviewStyle: 'standard' | 'challenging' | 'supportive';
  projectWalkthrough: {
    currentProject: string | null;
    projectsDiscussed: string[];
    currentQuestion: number;
    totalQuestions: number;
    projectDetails: {
      [key: string]: {
        description: string;
        technologies: string[];
        challenges: string[];
        solutions: string[];
        role: string;
        duration: string;
      };
    };
  };
}

const AI_API_URL = 'https://ai.hackclub.com/chat/completions';

// Initialize interview context with more detailed tracking
let interviewContext: InterviewContext = {
  jobRole: '',
  candidateResponses: [],
  overallScore: 0,
  technicalSkills: {},
  softSkills: {
    communicationScore: 0,
    problemSolvingScore: 0,
    clarificationQuality: 0,
    explanationClarity: 0
  },
  strengths: [],
  areasToImprove: [],
  interviewNotes: [],
  isInterviewComplete: false,
  stage: 'initial',
  questionsAsked: 0,
  currentQuestionDepth: 0,
  hasAskedClarification: false,
  lastResponseQuality: 'neutral',
  interviewStyle: 'standard',
  projectWalkthrough: {
    currentProject: null,
    projectsDiscussed: [],
    currentQuestion: 0,
    totalQuestions: 5,
    projectDetails: {}
  }
};

// Export the generateChatCompletion function
export const generateChatCompletion = async (messages: Message[]): Promise<string> => {
  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`AI API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling AI API:', error);
    return 'I apologize, but I encountered an error. Please try again.';
  }
};

const formatMarkdown = (text: string): string => {
  // Replace ** with proper markdown
  return text.replace(/\*\*(.*?)\*\*/g, '`$1`')
            .replace(/\n/g, '\n\n') // Ensure proper line breaks
            .replace(/```(\w+)?\n([\s\S]*?)\n```/g, (_, lang, code) => {
              // Properly format code blocks
              return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\``;
            });
};

const generateInterviewerPrompt = (role: string): string => {
  // Simplified context tracking
  const context = interviewContext.candidateResponses.length > 0 
    ? `Previous question: ${interviewContext.candidateResponses[interviewContext.candidateResponses.length - 1].question}`
    : 'No previous questions';

  // Shorter, more focused prompt
  let prompt = `You are Alex, a technical interviewer for a ${role} position. 
  Keep your questions and responses brief and focused.
  
  Context: ${context}
  Stage: ${interviewContext.stage}
  Questions Asked: ${interviewContext.questionsAsked}/7
  
  Guidelines:
  1. Keep questions short and direct
  2. Adapt difficulty based on performance
  3. Provide brief, clear responses
  4. Focus on one concept at a time`;

  // Simplified stage-specific instructions
  switch (interviewContext.stage) {
    case 'initial':
      prompt += '\n\nAsk about their desired role briefly.';
      break;
    case 'introduction':
      prompt += '\n\nAsk a short question about their background.';
      break;
    case 'background':
      prompt += '\n\nAsk a brief question about their technical experience.';
      break;
    case 'technical_discussion':
      prompt += '\n\nAsk a concise conceptual question.';
      break;
    case 'coding':
      prompt += '\n\nProvide a brief coding question with a function signature.';
      break;
    case 'system_design':
      prompt += '\n\nAsk a short system design question.';
      break;
    case 'questions':
      prompt += '\n\nAnswer their questions briefly.';
      break;
  }

  return prompt;
};

const generateAIQuestions = (jobRole: string): string => {
  const isAIRole = jobRole.toLowerCase().includes('ai') || jobRole.toLowerCase().includes('ml');
  const isSeniorRole = jobRole.toLowerCase().includes('senior') || jobRole.toLowerCase().includes('lead');
  const isFullStack = jobRole.toLowerCase().includes('full') && jobRole.toLowerCase().includes('stack');
  
  // Get the current question type based on the interview structure
  const questionTypes = ['personal', 'personal', 'personal', 'theory', 'theory', 'code', 'personal'];
  const currentQuestionType = questionTypes[interviewContext.questionsAsked % questionTypes.length];
  
  // Shorter prompts based on question type
  if (currentQuestionType === 'personal') {
    return `Ask a brief personal question about the candidate's background, experience, or interests. Keep it concise and focused.`;
  } else if (currentQuestionType === 'theory') {
    return `Ask a short theoretical question about ${isAIRole ? 'AI/ML concepts' : isFullStack ? 'web development' : 'programming fundamentals'}. Keep it brief and clear.`;
  } else if (currentQuestionType === 'code') {
    return `Ask a concise coding question with a simple problem statement. Include a function signature with parameters and return type.`;
  }
  
  // Fallback
  return `Ask a brief question about ${jobRole}. Keep it concise and focused.`;
};

const formatCodeQuestion = (text: string): string => {
  return text
    // Format headers properly
    .replace(/###\s+([^\n]+)/g, '**$1**')
    // Format code blocks properly
    .replace(/```(\w+)?\n([\s\S]*?)\n```/g, (_, lang, code) => {
      return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\``;
    })
    // Ensure proper line breaks
    .replace(/\n/g, '\n\n')
    // Format inline code
    .replace(/`([^`]+)`/g, '`$1`');
};

const extractFunctionSignature = (question: string): { signature: string; parameters: string[]; returnType: string } => {
  // Default values
  let signature = "solution()";
  let parameters: string[] = [];
  let returnType = "any";

  console.log("Extracting function signature from question:", question);

  // Try to extract function signature from the question
  const signatureMatch = question.match(/Function Signature:\s*```\s*([\s\S]*?)\s*```/);
  
  if (signatureMatch) {
    console.log("Found explicit function signature match:", signatureMatch);
    const signatureText = signatureMatch[1].trim();
    
    // Check if this is a class-based signature
    if (signatureText.includes('class')) {
      // Extract class name
      const classNameMatch = signatureText.match(/class\s+(\w+)/);
      if (classNameMatch) {
        const className = classNameMatch[1];
        signature = `${className}()`;
        
        // Extract methods from the class
        const methodMatches = signatureText.match(/def\s+(\w+)\s*\((.*?)\)\s*->\s*([^:]+):/g) || [];
        if (methodMatches.length > 0) {
          // Use the first method as the main function
          const firstMethod = methodMatches[0];
          if (firstMethod) {
            const methodNameMatch = firstMethod.match(/def\s+(\w+)/);
            const paramMatch = firstMethod.match(/\((.*?)\)/);
            const returnTypeMatch = firstMethod.match(/->\s*([^:]+):/);
            
            if (methodNameMatch && paramMatch) {
              const methodName = methodNameMatch[1];
              const paramText = paramMatch[1];
              
              // Extract parameters
              parameters = paramText.split(',').map(p => {
                const paramParts = p.trim().split(':');
                return paramParts[0].trim();
              });
              
              // Extract return type
              if (returnTypeMatch) {
                returnType = returnTypeMatch[1].trim();
              }
              
              signature = `${className}.${methodName}(${parameters.join(', ')})`;
            }
          }
        }
      }
    } else {
      // Handle regular function signature
      signature = signatureText;
      
      // Extract parameters from the signature
      const paramMatch = signature.match(/\((.*?)\)/);
      if (paramMatch && paramMatch[1]) {
        parameters = paramMatch[1].split(',').map(p => {
          const paramParts = p.trim().split(':');
          return paramParts[0].trim();
        });
      }
      
      // Extract return type if specified
      const returnTypeMatch = signature.match(/->\s*([^:]+):/);
      if (returnTypeMatch) {
        returnType = returnTypeMatch[1].trim();
      }
    }
    
    // If no return type was found, determine it based on question content
    if (returnType === "any") {
      if (question.toLowerCase().includes('return true') || question.toLowerCase().includes('return false')) {
        returnType = "boolean";
      } else if (question.toLowerCase().includes('return a string') || question.toLowerCase().includes('return the string')) {
        returnType = "string";
      } else if (question.toLowerCase().includes('return a number') || question.toLowerCase().includes('return the number')) {
        returnType = "number";
      } else if (question.toLowerCase().includes('return an array') || question.toLowerCase().includes('return the array')) {
        returnType = "array";
      } else if (question.toLowerCase().includes('return a list') || question.toLowerCase().includes('return the list')) {
        returnType = "list";
      } else if (question.toLowerCase().includes('return a dictionary') || question.toLowerCase().includes('return the dictionary')) {
        returnType = "dict";
      }
    }
  } else {
    // If no explicit function signature found, try to infer parameters from examples
    console.log("No explicit function signature found, trying to infer from examples");
    const exampleMatch = question.match(/Example:\s*Input:\s*([^\n]+)/i);
    if (exampleMatch) {
      console.log("Found example input:", exampleMatch[1]);
      const exampleInput = exampleMatch[1];
      const paramMatches = exampleInput.match(/\w+\s*=\s*[^,]+/g);
      if (paramMatches) {
        console.log("Found parameter matches:", paramMatches);
        parameters = paramMatches.map(p => p.split('=')[0].trim());
        signature = `solution(${parameters.join(', ')})`;
      }
    }
  }
  
  console.log("Extracted signature:", signature);
  console.log("Extracted parameters:", parameters);
  console.log("Extracted return type:", returnType);
  
  return { signature, parameters, returnType };
};

const generateProjectWalkthroughPrompt = (): string => {
  const { currentProject, projectsDiscussed, currentQuestion, totalQuestions, projectDetails } = interviewContext.projectWalkthrough;
  
  if (!currentProject) {
    return `Ask the candidate to describe a significant project they've worked on recently. 
    Focus on understanding their role, the technologies used, and the challenges they faced.
    Ask for specific details about their contributions and problem-solving approach.`;
  }
  
  const project = projectDetails[currentProject];
  const questions = [
    `Can you walk me through the architecture of the ${currentProject} project? What design patterns did you use and why?`,
    `What were the biggest technical challenges you faced in the ${currentProject} project? How did you overcome them?`,
    `How did you handle scalability in the ${currentProject} project? What would you do differently now?`,
    `Tell me about a specific bug or issue that was difficult to solve in the ${currentProject} project. How did you approach debugging it?`,
    `How did you ensure code quality in the ${currentProject} project? What testing strategies did you use?`,
    `What was your deployment process for the ${currentProject} project? How did you handle CI/CD?`,
    `How did you collaborate with other team members on the ${currentProject} project? What was your role in code reviews?`,
    `What technologies or tools did you use in the ${currentProject} project that you hadn't used before? How did you learn them?`,
    `How did you measure the success of the ${currentProject} project? What metrics did you track?`,
    `If you could improve one aspect of the ${currentProject} project, what would it be and why?`
  ];
  
  return `Ask the candidate the following question about their ${currentProject} project:
  
  ${questions[currentQuestion % questions.length]}
  
  Evaluate their response based on:
  1. Technical depth
  2. Problem-solving approach
  3. Communication clarity
  4. Self-reflection
  5. Learning mindset
  
  After this question, we will have asked ${currentQuestion + 1} of ${totalQuestions} questions about this project.`;
};

// Add a new method for code suggestions
export const getCodeSuggestions = async (
  code: string, 
  currentLine: string, 
  contextBefore: string, 
  contextAfter: string, 
  problemStatement: string
): Promise<string> => {
  try {
    const prompt = `I'm working on this coding problem:

${problemStatement}

Here's my current code:
\`\`\`
${code}
\`\`\`

I'm currently at this line:
\`\`\`
${currentLine}
\`\`\`

Context before:
\`\`\`
${contextBefore}
\`\`\`

Context after:
\`\`\`
${contextAfter}
\`\`\`

Please provide suggestions for improving this code or help me implement the solution.`;

    const messages: Message[] = [
      { role: 'system', content: 'You are an expert programming assistant helping a candidate during a technical interview. Provide helpful suggestions and guidance for their code implementation.' },
      { role: 'user', content: prompt }
    ];

    const response = await generateChatCompletion(messages);
    return response;
  } catch (error) {
    console.error('Error getting code suggestions:', error);
    return 'Sorry, I encountered an error while generating suggestions. Please try again.';
  }
};

// Define the handleQuestionGeneration function
const handleQuestionGeneration = async (): Promise<ChatResponse> => {
  console.log('handleQuestionGeneration called, current questionsAsked:', interviewContext.questionsAsked);
  
  if (interviewContext.questionsAsked >= 7) {
    interviewContext.stage = 'complete';
    return {
      message: "We've completed all the technical questions. Would you like to conclude the interview and receive feedback?"
    };
  }

  const messages: Message[] = [
    { role: 'system', content: generateInterviewerPrompt(interviewContext.jobRole) },
    { role: 'user', content: generateAIQuestions(interviewContext.jobRole) }
  ];

  const response = await generateChatCompletion(messages);
  
  // Increment the counter BEFORE using it in the message
  interviewContext.questionsAsked++;
  console.log('Incremented questionsAsked to:', interviewContext.questionsAsked);
  
  // Extract function signature and parameters from the question
  const { signature, parameters, returnType } = extractFunctionSignature(response);
  
  // Add function signature information to the response
  const enhancedResponse = `${response}\n\n**Function Signature:**\n\`\`\`\n${signature}\n\`\`\`\n\n**Parameters:**\n${parameters.map(p => `- \`${p}\``).join('\n')}\n\n**Return Type:** \`${returnType}\``;
  
  return {
    message: formatMarkdown(`Let's move on to technical question ${interviewContext.questionsAsked}/7:\n\n${enhancedResponse}`)
  };
};

export const api = {
  evaluateSolution: async (code: string, question: string): Promise<Evaluation> => {
    // First execute the code to get the output
    const execResult = await executeCode(code, 'python', []);
    
    // Then evaluate the solution
    const prompt = `Review this code solution:

Question: ${question}

Code:
\`\`\`
${code}
\`\`\`

${execResult.error ? `Execution Error: ${execResult.error}` : `Output: ${execResult.output}`}

Evaluate considering:
1. Correctness
2. Efficiency
3. Code style
4. Error handling
5. Edge cases
6. Problem-solving approach
7. Code organization
8. Variable naming
9. Comments and documentation
10. Potential optimizations

Also assess:
- Understanding of the problem
- Quality of the solution
- Technical proficiency
- Attention to detail
- Problem-solving methodology

Score each aspect out of 5 and provide specific observations.`;
    
    const messages: Message[] = [
      { role: 'system', content: generateInterviewerPrompt(interviewContext.jobRole) },
      { role: 'user', content: prompt }
    ];

    const feedback = await generateChatCompletion(messages);
    
    // Update interview context with detailed evaluation
    const scoreMatch = feedback.match(/Score:\s*(\d+\.?\d*)\/5/);
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      
      // Update technical skills
      const skillsToUpdate = ['problemSolving', 'codeQuality', 'algorithmicThinking'];
      skillsToUpdate.forEach(skill => {
        if (!interviewContext.technicalSkills[skill]) {
          interviewContext.technicalSkills[skill] = { score: 0, notes: [] };
        }
        interviewContext.technicalSkills[skill].score = 
          (interviewContext.technicalSkills[skill].score + score) / 2;
      });

      // Store response
      interviewContext.candidateResponses.push({
        question,
        response: code,
        score,
        followUpResponses: []
      });
      
      // Update overall score
      interviewContext.overallScore = interviewContext.candidateResponses.reduce(
        (avg, curr) => avg + curr.score, 0
      ) / interviewContext.candidateResponses.length;

      // Store feedback
      interviewContext.interviewNotes.push(feedback);

      // Adjust interview style based on performance
      if (score >= 4) {
        interviewContext.interviewStyle = 'challenging';
      } else if (score <= 2) {
        interviewContext.interviewStyle = 'supportive';
      }
    }
    
    // During interview, focus on understanding their approach
    const followUpQuestions = [
      "Could you walk me through your solution?",
      "What was your thought process in choosing this approach?",
      "How would you handle edge cases?",
      "What's the time and space complexity?",
      "How would you improve this solution?"
    ];
    
    const randomIndex = Math.floor(Math.random() * followUpQuestions.length);
    return {
      feedback: formatMarkdown(followUpQuestions[randomIndex])
    };
  },

  sendMessage: async (message: string): Promise<ChatResponse> => {
    try {
      console.log('API sendMessage called with:', message);
      console.log('Current stage:', interviewContext.stage);
      console.log('Current questionsAsked:', interviewContext.questionsAsked);
      
      // Handle special commands
      if (message.startsWith('/123')) {
        // Transition to questions stage
        interviewContext.stage = 'questions';
        return {
          message: 'Let\'s move on to the technical questions. I\'ll ask you a series of coding problems to evaluate your technical skills.'
        };
      }
      
      // Handle move on command
      if (message.toLowerCase() === '/move on') {
        // Determine the next stage based on the current stage
        let nextStage: InterviewStage = interviewContext.stage;
        let transitionMessage = '';
        
        switch (interviewContext.stage) {
          case 'initial':
            nextStage = 'introduction';
            transitionMessage = 'Let\'s begin with a brief introduction. Could you tell me about yourself and your background?';
            break;
          case 'introduction':
            nextStage = 'background';
            transitionMessage = 'Now, let\'s discuss your background and experience in more detail. What projects have you worked on recently?';
            break;
          case 'background':
            nextStage = 'technical_discussion';
            transitionMessage = 'Let\'s move on to some technical discussion. I\'ll ask you about your technical skills and experience.';
            break;
          case 'technical_discussion':
            nextStage = 'coding';
            transitionMessage = 'Now, let\'s move on to some coding challenges. I\'ll present you with a problem, and you can implement your solution.';
            break;
          case 'coding':
            nextStage = 'system_design';
            transitionMessage = 'Let\'s discuss system design. I\'ll present you with a design problem, and you can walk me through your approach.';
            break;
          case 'system_design':
            nextStage = 'questions';
            transitionMessage = 'Now, let\'s move on to some coding problems. I\'ll ask you to implement solutions to these problems.';
            break;
          case 'questions':
            if (interviewContext.questionsAsked >= 7) {
              nextStage = 'complete';
              transitionMessage = 'We\'ve completed all the technical questions. Let\'s wrap up the interview. Do you have any questions for me?';
            } else {
              // Stay in questions stage but move to the next question
              return handleQuestionGeneration();
            }
            break;
          case 'complete':
            // Already complete, no next stage
            return {
              message: 'The interview is already complete. Thank you for participating!'
            };
          default:
            // Default to moving to the next stage
            const stages: InterviewStage[] = ['initial', 'introduction', 'background', 'technical_discussion', 'coding', 'system_design', 'questions', 'complete'];
            const currentIndex = stages.indexOf(interviewContext.stage);
            if (currentIndex < stages.length - 1) {
              nextStage = stages[currentIndex + 1];
              transitionMessage = `Let's move on to the ${nextStage.replace('_', ' ')} phase.`;
            } else {
              return {
                message: 'The interview is already complete. Thank you for participating!'
              };
            }
        }
        
        // Update the interview stage
        interviewContext.stage = nextStage;
        
        // If we're moving to the questions stage, generate a question
        if (nextStage === 'questions') {
          return handleQuestionGeneration();
        }
        
        return {
          message: transitionMessage
        };
      }
      
      // Handle initial job role input
      if (interviewContext.stage === 'initial') {
        interviewContext.jobRole = message;
        interviewContext.stage = 'introduction';
        return {
          message: `Thank you for applying for the ${message} position. Let's begin with a brief introduction. Could you tell me about yourself and your background?`
        };
      }
      
      // Handle project walkthrough
      if (interviewContext.stage === 'background' && message.toLowerCase().includes('project')) {
        // If we don't have a current project, ask for one
        if (!interviewContext.projectWalkthrough.currentProject) {
          const projectName = message.split('project')[1]?.trim() || 'your project';
          interviewContext.projectWalkthrough.currentProject = projectName;
          interviewContext.projectWalkthrough.projectsDiscussed.push(projectName);
          
          // Generate a prompt for the next question about this project
          const prompt = generateProjectWalkthroughPrompt();
          const response = await generateChatCompletion([
            { role: 'system', content: 'You are an experienced technical interviewer. Ask insightful questions about the candidate\'s projects.' },
            { role: 'user', content: prompt }
          ]);
          
          return {
            message: response
          };
        } else {
          // We have a current project, ask the next question
          const prompt = generateProjectWalkthroughPrompt();
          const response = await generateChatCompletion([
            { role: 'system', content: 'You are an experienced technical interviewer. Ask insightful questions about the candidate\'s projects.' },
            { role: 'user', content: prompt }
          ]);
          
          // Increment the question counter
          interviewContext.projectWalkthrough.currentQuestion++;
          
          // If we've asked all questions about this project, move to the next stage
          if (interviewContext.projectWalkthrough.currentQuestion >= interviewContext.projectWalkthrough.totalQuestions) {
            interviewContext.projectWalkthrough.currentProject = null;
            interviewContext.stage = 'technical_discussion';
            
            return {
              message: `${response}\n\nNow that we've discussed your project, let's move on to some technical questions.`
            };
          }
          
          return {
            message: response
          };
        }
      }
      
      // Format the response based on the user's message
      const formattedResponse = formatMarkdown(message);
      
      // Check if it's time to transition to questions
      if (interviewContext.stage === 'technical_discussion' && 
          (message.toLowerCase().includes('experience') || message.toLowerCase().includes('background'))) {
        interviewContext.questionsAsked++;
        interviewContext.stage = 'questions';
        return handleQuestionGeneration();
      }
      
      // Extract function signature from coding questions
      if (interviewContext.stage === 'questions' && message.includes('Question')) {
        const { signature, parameters, returnType } = extractFunctionSignature(message);
        
        // Enhance the response with function signature details
        const enhancedResponse = `${formattedResponse}\n\n**Function Signature:**\n\`\`\`\n${signature}\n\`\`\`\n\n**Parameters:**\n${parameters.map(p => `- \`${p}\``).join('\n')}\n\n**Return Type:** \`${returnType}\``;
        
        return {
          message: enhancedResponse
        };
      }
      
      // For simple messages like "hi", provide a direct response
      if (message.toLowerCase() === 'hi' || message.toLowerCase() === 'hello') {
        return {
          message: 'Hello! How can I help you today?'
        };
      }
      
      // For all other messages, use the AI to generate a response
      const messages: Message[] = [
        { role: 'system', content: generateInterviewerPrompt(interviewContext.jobRole) },
        { role: 'user', content: message }
      ];
      
      const response = await generateChatCompletion(messages);
      
      // Log the response for debugging
      console.log('API generated response:', response);
      
      // Ensure the response is properly formatted
      const formattedApiResponse = response.trim();
      
      // If we're in the questions stage and this is a response to a question, increment the counter
      if (interviewContext.stage === 'questions' && interviewContext.questionsAsked < 7) {
        console.log('Incrementing questionsAsked from', interviewContext.questionsAsked);
        interviewContext.questionsAsked++;
        console.log('questionsAsked now:', interviewContext.questionsAsked);
        
        // If we've reached the end of the questions, move to complete stage
        if (interviewContext.questionsAsked >= 7) {
          console.log('All questions completed, moving to complete stage');
          interviewContext.stage = 'complete';
        }
      }
      
      return {
        message: formattedApiResponse
      };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return {
        message: 'I encountered an error processing your message. Please try again.'
      };
    }
  },

  completeInterview: async (): Promise<string> => {
    interviewContext.isInterviewComplete = true;
    
    const prompt = `Provide a comprehensive interview summary:

1. Overall Performance
2. Key Strengths
3. Areas for Improvement
4. Specific Examples from Responses
5. Final Recommendations

Base this on the following interview data:
${interviewContext.interviewNotes.join('\n\n')}`;

    const messages: Message[] = [
      { role: 'system', content: 'You are providing a final interview assessment. Be constructive and specific in your feedback.' },
      { role: 'user', content: prompt }
    ];

    const feedback = await generateChatCompletion(messages);
    return formatMarkdown(feedback);
  },

  resetContext: () => {
    interviewContext = {
      jobRole: '',
      candidateResponses: [],
      overallScore: 0,
      technicalSkills: {},
      softSkills: {
        communicationScore: 0,
        problemSolvingScore: 0,
        clarificationQuality: 0,
        explanationClarity: 0
      },
      strengths: [],
      areasToImprove: [],
      interviewNotes: [],
      isInterviewComplete: false,
      stage: 'initial',
      questionsAsked: 0,
      currentQuestionDepth: 0,
      hasAskedClarification: false,
      lastResponseQuality: 'neutral',
      interviewStyle: 'standard',
      projectWalkthrough: {
        currentProject: null,
        projectsDiscussed: [],
        currentQuestion: 0,
        totalQuestions: 5,
        projectDetails: {}
      }
    };
  },

  getCodeSuggestions: async (
    code: string, 
    currentLine: string, 
    contextBefore: string, 
    contextAfter: string, 
    problemStatement: string
  ): Promise<string> => {
    return getCodeSuggestions(code, currentLine, contextBefore, contextAfter, problemStatement);
  },
}; 