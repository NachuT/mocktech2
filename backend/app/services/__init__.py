# Services package 
from .ai_service import AIService

generate_question = AIService.generate_question
evaluate_solution = AIService.evaluate_solution
chat_with_ai = AIService.generate_response 