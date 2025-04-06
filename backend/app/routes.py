import logging
from flask import Blueprint, request, jsonify, make_response
from .services.ai_service import generate_question_with_ai, evaluate_solution_with_ai, chat_with_ai

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

api = Blueprint('api', __name__)

def add_cors_headers(response):
    if isinstance(response, tuple):
        response = make_response(jsonify(response[0]), response[1])
    elif not isinstance(response, (Response, Flask.response_class)):
        response = make_response(jsonify(response))
    
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@api.route('/health', methods=['GET'])
def health():
    return add_cors_headers({'status': 'healthy'})

@api.route('/generate-question', methods=['POST'])
def generate_question():
    try:
        data = request.get_json()
        job_role = data.get('jobRole', 'software engineer')
        difficulty = data.get('difficulty', 'medium')
        
        question = generate_question_with_ai(job_role, difficulty)
        return add_cors_headers({
            'question': question,
            'metadata': {
                'difficulty': difficulty,
                'jobRole': job_role
            }
        })
    except Exception as e:
        logging.error(f"Error generating question: {str(e)}")
        return add_cors_headers(({'error': 'Failed to generate question'}, 500))

@api.route('/evaluate-solution', methods=['POST'])
def evaluate_solution():
    try:
        data = request.get_json()
        code = data.get('code')
        question = data.get('question')
        
        if not code or not question:
            return add_cors_headers(({'error': 'Code and question are required'}, 400))
        
        feedback = evaluate_solution_with_ai(code, question)
        return add_cors_headers({'feedback': feedback})
    except Exception as e:
        logging.error(f"Error evaluating solution: {str(e)}")
        return add_cors_headers(({'error': 'Failed to evaluate solution'}, 500))

@api.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = data.get('message')
        
        if not message:
            return add_cors_headers(({'error': 'Message is required'}, 400))
        
        response = chat_with_ai(message)
        return add_cors_headers({'message': response})
    except Exception as e:
        logging.error(f"Error in chat: {str(e)}")
        return add_cors_headers(({'error': 'Failed to process chat message'}, 500)) 