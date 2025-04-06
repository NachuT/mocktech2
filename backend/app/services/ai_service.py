from typing import Dict, Any, List
import requests
import json
import os
import logging
from typing import Optional

logging.basicConfig(level=logging.DEBUG)

class AIService:
    API_URL = "https://ai.hackclub.com/chat/completions"
    
    @staticmethod
    def _make_request(system_message: str, user_message: str) -> str:
        try:
            response = requests.post(
                AIService.API_URL,
                headers={
                    "Content-Type": "application/json"
                },
                json={
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_message}
                    ]
                }
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except requests.exceptions.RequestException as e:
            print(f"Error making request to AI API: {e}")
            return "I apologize, but I'm having trouble connecting to the AI service at the moment."
        except Exception as e:
            print(f"Unexpected error: {e}")
            return "I apologize, but I'm having trouble processing your request at the moment."
    
    @staticmethod
    def generate_question(job_role: str, difficulty: str = "medium") -> dict:
        system_message = f"""You are an expert technical interviewer. Generate a coding problem suitable for a {job_role} position.
        The problem should be of {difficulty} difficulty. Include a clear problem statement, examples, and constraints."""
        
        user_message = f"Generate a coding problem for a {job_role} candidate."
        
        response = AIService._make_request(system_message, user_message)
        
        return {
            "question": response,
            "metadata": {
                "difficulty": difficulty,
                "category": None,
                "job_role": job_role
            }
        }
    
    @staticmethod
    def evaluate_solution(code: str, question: str, language: str = "python") -> dict:
        system_message = f"""You are an expert code reviewer specializing in {language}. Evaluate the provided solution based on:
        1. Correctness
        2. Time and space complexity
        3. Code quality and style (following {language} best practices)
        4. Potential improvements
        Provide constructive feedback and suggestions."""
        
        user_message = f"Question:\n{question}\n\nCandidate's Solution ({language}):\n{code}"
        
        response = AIService._make_request(system_message, user_message)
        
        return {
            "feedback": response
        }

    @staticmethod
    def generate_response(message: str, context: dict) -> str:
        job_role = context.get('jobRole', '')
        current_question = context.get('currentQuestion', '')
        
        system_message = f"""You are an AI technical interviewer conducting an interview for a {job_role} position.
        Your role is to:
        1. Guide the candidate through the interview process
        2. Answer their questions about the current problem
        3. Provide hints without giving away the solution
        4. Maintain a professional and encouraging tone
        5. Stay focused on the technical aspects of the interview
        
        Current question: {current_question}"""
        
        response = AIService._make_request(system_message, message)
        return response 

def generate_question_with_ai(job_role: str, difficulty: str) -> str:
    # Mock response since we don't have API keys
    return f"Write a function that demonstrates your understanding of {job_role} concepts at a {difficulty} level. Focus on best practices and efficient implementation."

def evaluate_solution_with_ai(code: str, question: str) -> str:
    # Mock response since we don't have API keys
    return f"""Code evaluation:
1. Code structure and organization: Good
2. Implementation approach: Appropriate
3. Best practices: Generally followed
4. Areas for improvement:
   - Consider adding more comments
   - Add error handling
   - Consider edge cases
   
Overall, the solution demonstrates understanding of the core concepts."""

def chat_with_ai(message: str) -> str:
    # Mock response since we don't have API keys
    return f"I understand you're asking about: {message}\nLet me help you with that. What specific aspects would you like me to explain?" 