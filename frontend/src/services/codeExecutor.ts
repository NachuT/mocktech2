import axios from 'axios';

export interface CodeResult {
  output: string;
  error?: string;
  inputs?: string[];
}

/**
 * Executes code in the specified language with the given inputs
 * @param code The code to execute
 * @param language The programming language
 * @param inputs Input values for the code
 * @returns The execution result
 */
export const executeCode = async (
  code: string, 
  language: string, 
  inputs: string[] = []
): Promise<CodeResult> => {
  try {
    console.log(`Executing ${language} code with inputs:`, inputs);
    
    // Check if language is supported
    const supportedLanguages = ['python', 'javascript', 'cpp'];
    if (!supportedLanguages.includes(language.toLowerCase())) {
      return {
        output: '',
        error: `Language ${language} is not supported yet. Supported languages: ${supportedLanguages.join(', ')}.`,
        inputs: inputs.length > 0 ? inputs : undefined
      };
    }
    
    // Prepare the code with input handling based on language
    let codeToExecute = code;
    
    // If there are inputs, add code to handle them
    if (inputs.length > 0) {
      switch (language.toLowerCase()) {
        case 'python':
          // Add input handling code at the beginning
          const pythonInputHandlingCode = `
import sys
from io import StringIO

# Redirect stdin to simulate inputs
input_values = ${JSON.stringify(inputs)}
input_index = 0

def mock_input(prompt=""):
    global input_index
    if input_index < len(input_values):
        value = input_values[input_index]
        input_index += 1
        return value
    return ""

# Replace the built-in input function
__builtins__.input = mock_input

# Capture stdout
old_stdout = sys.stdout
sys.stdout = StringIO()

try:
`;
          // Add code to restore stdout and get output at the end
          const pythonOutputHandlingCode = `
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
finally:
    # Restore stdout and get output
    sys.stdout = old_stdout
    output = sys.stdout.getvalue()
    print(output)
`;
          codeToExecute = pythonInputHandlingCode + codeToExecute + pythonOutputHandlingCode;
          break;
          
        case 'javascript':
          // Add input handling code at the beginning
          const jsInputHandlingCode = `
// Redirect console.log to capture output
const originalConsoleLog = console.log;
const logs = [];
console.log = (...args) => {
  logs.push(args.join(' '));
  originalConsoleLog.apply(console, args);
};

// Mock input function
const inputValues = ${JSON.stringify(inputs)};
let inputIndex = 0;
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const mockInput = () => {
  if (inputIndex < inputValues.length) {
    return inputValues[inputIndex++];
  }
  return "";
};

// Replace readline.question with mock
readline.question = (query, callback) => {
  callback(mockInput());
};

try {
`;
          // Add code to restore console.log and get output at the end
          const jsOutputHandlingCode = `
} catch (error) {
  console.error(\`Error: \${error.message}\`);
} finally {
  // Restore console.log
  console.log = originalConsoleLog;
  // Print captured logs
  console.log(logs.join('\\n'));
}
`;
          codeToExecute = jsInputHandlingCode + codeToExecute + jsOutputHandlingCode;
          break;
          
        case 'cpp':
          // For C++, we'll wrap the code in a main function if it doesn't have one
          if (!code.includes('int main(') && !code.includes('void main(')) {
            codeToExecute = `
#include <iostream>
#include <string>
#include <vector>

// Input simulation
std::vector<std::string> inputValues = ${JSON.stringify(inputs)};
int inputIndex = 0;

std::string getInput() {
  if (inputIndex < inputValues.size()) {
    return inputValues[inputIndex++];
  }
  return "";
}

// Redirect cin to simulate inputs
struct InputRedirect {
  std::string buffer;
  std::streambuf* oldCin;
  
  InputRedirect() : oldCin(std::cin.rdbuf()) {
    std::cin.rdbuf(new std::stringbuf(buffer));
  }
  
  ~InputRedirect() {
    std::cin.rdbuf(oldCin);
  }
};

// Your code starts here
${codeToExecute}
// Your code ends here

int main() {
  try {
    InputRedirect redirect;
    // Call the main function or execute the code
    ${codeToExecute.includes('int main(') || codeToExecute.includes('void main(') ? '' : '// Code will be executed here'}
    return 0;
  } catch (const std::exception& e) {
    std::cerr << "Error: " << e.what() << std::endl;
    return 1;
  }
}`;
          } else {
            // If main function already exists, just wrap it with input handling
            codeToExecute = `
#include <iostream>
#include <string>
#include <vector>

// Input simulation
std::vector<std::string> inputValues = ${JSON.stringify(inputs)};
int inputIndex = 0;

std::string getInput() {
  if (inputIndex < inputValues.size()) {
    return inputValues[inputIndex++];
  }
  return "";
}

// Redirect cin to simulate inputs
struct InputRedirect {
  std::string buffer;
  std::streambuf* oldCin;
  
  InputRedirect() : oldCin(std::cin.rdbuf()) {
    std::cin.rdbuf(new std::stringbuf(buffer));
  }
  
  ~InputRedirect() {
    std::cin.rdbuf(oldCin);
  }
};

${codeToExecute}`;
          }
          break;
      }
    }
    
    // Send the code to the execution service
    const response = await axios.post('/api/execute-code', {
      code: codeToExecute,
      language: language.toLowerCase()
    });
    
    const { output, error } = response.data;
    
    // If there's no output and no error, provide a helpful message
    if (!output && !error) {
      return {
        output: 'Code executed successfully but produced no output. If your code uses print/console.log/cout or similar functions, make sure they are included in your solution.',
        error: undefined,
        inputs: inputs.length > 0 ? inputs : undefined
      };
    }
    
    return {
      output: output || '',
      error: error || undefined,
      inputs: inputs.length > 0 ? inputs : undefined
    };
  } catch (error) {
    console.error('Error executing code:', error);
    return {
      output: '',
      error: 'Failed to execute code. Please try again.',
      inputs: inputs.length > 0 ? inputs : undefined
    };
  }
}; 