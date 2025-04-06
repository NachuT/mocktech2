import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(request: NextRequest) {
  try {
    const { code, language } = await request.json();
    
    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }
    
    // Check if language is supported
    const supportedLanguages = ['python', 'javascript', 'cpp'];
    if (!supportedLanguages.includes(language.toLowerCase())) {
      return NextResponse.json({ error: `Language ${language} is not supported. Supported languages: ${supportedLanguages.join(', ')}` }, { status: 400 });
    }
    
    // Execute the code based on language
    let result;
    switch (language.toLowerCase()) {
      case 'python':
        result = await executePythonCode(code);
        break;
      case 'javascript':
        result = await executeJavaScriptCode(code);
        break;
      case 'cpp':
        result = await executeCppCode(code);
        break;
      default:
        return NextResponse.json({ error: 'Unsupported language' }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error executing code:', error);
    return NextResponse.json({ error: 'Failed to execute code' }, { status: 500 });
  }
}

function executePythonCode(code: string): Promise<{ output: string; error?: string }> {
  return new Promise((resolve, reject) => {
    // Create a temporary Python file
    const pythonProcess = spawn('python3', ['-c', code]);
    
    let output = '';
    let error = '';
    
    // Capture stdout
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // Capture stderr
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        resolve({ output: '', error: error || 'Process exited with non-zero code' });
      } else {
        resolve({ output: output.trim(), error: error || undefined });
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (err) => {
      reject(err);
    });
  });
}

function executeJavaScriptCode(code: string): Promise<{ output: string; error?: string }> {
  return new Promise((resolve, reject) => {
    // Create a temporary JavaScript file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `code-${Date.now()}.js`);
    
    // Write code to temporary file
    fs.writeFileSync(tempFile, code);
    
    // Execute the JavaScript file
    const nodeProcess = spawn('node', [tempFile]);
    
    let output = '';
    let error = '';
    
    // Capture stdout
    nodeProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // Capture stderr
    nodeProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    // Handle process completion
    nodeProcess.on('close', (code) => {
      // Clean up temporary file
      try {
        fs.unlinkSync(tempFile);
      } catch (err) {
        console.error('Error deleting temporary file:', err);
      }
      
      if (code !== 0) {
        resolve({ output: '', error: error || 'Process exited with non-zero code' });
      } else {
        resolve({ output: output.trim(), error: error || undefined });
      }
    });
    
    // Handle process errors
    nodeProcess.on('error', (err) => {
      // Clean up temporary file
      try {
        fs.unlinkSync(tempFile);
      } catch (unlinkErr) {
        console.error('Error deleting temporary file:', unlinkErr);
      }
      
      reject(err);
    });
  });
}

function executeCppCode(code: string): Promise<{ output: string; error?: string }> {
  return new Promise((resolve, reject) => {
    // Create temporary files
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `code-${Date.now()}.cpp`);
    const executableFile = path.join(tempDir, `code-${Date.now()}`);
    
    // Write code to temporary file
    fs.writeFileSync(tempFile, code);
    
    // Compile the C++ code
    const compileProcess = spawn('g++', ['-std=c++11', tempFile, '-o', executableFile]);
    
    let compileError = '';
    
    // Capture stderr during compilation
    compileProcess.stderr.on('data', (data) => {
      compileError += data.toString();
    });
    
    // Handle compilation completion
    compileProcess.on('close', (code) => {
      // Clean up source file
      try {
        fs.unlinkSync(tempFile);
      } catch (err) {
        console.error('Error deleting temporary source file:', err);
      }
      
      if (code !== 0) {
        resolve({ output: '', error: compileError || 'Compilation failed' });
        return;
      }
      
      // Execute the compiled program
      const execProcess = spawn(executableFile);
      
      let output = '';
      let error = '';
      
      // Capture stdout
      execProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // Capture stderr
      execProcess.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      // Handle execution completion
      execProcess.on('close', (code) => {
        // Clean up executable file
        try {
          fs.unlinkSync(executableFile);
        } catch (err) {
          console.error('Error deleting temporary executable file:', err);
        }
        
        if (code !== 0) {
          resolve({ output: '', error: error || 'Process exited with non-zero code' });
        } else {
          resolve({ output: output.trim(), error: error || undefined });
        }
      });
      
      // Handle execution errors
      execProcess.on('error', (err) => {
        // Clean up executable file
        try {
          fs.unlinkSync(executableFile);
        } catch (unlinkErr) {
          console.error('Error deleting temporary executable file:', unlinkErr);
        }
        
        reject(err);
      });
    });
    
    // Handle compilation errors
    compileProcess.on('error', (err) => {
      // Clean up source file
      try {
        fs.unlinkSync(tempFile);
      } catch (unlinkErr) {
        console.error('Error deleting temporary source file:', unlinkErr);
      }
      
      reject(err);
    });
  });
} 