import pytest
from app.services.interview_service import InterviewService
from unittest.mock import patch

def test_generate_question_success():
    with patch('openai.chat.completions.create') as mock_create:
        # Mock the OpenAI response
        mock_create.return_value.choices = [
            type('obj', (), {'message': type('obj', (), {'content': 'Test question'})})()
        ]
        
        result = InterviewService.generate_question(
            job_role="Software Engineer",
            difficulty="medium",
            category="algorithms"
        )
        
        assert result["success"] is True
        assert "question" in result
        assert result["metadata"]["job_role"] == "Software Engineer"
        assert result["metadata"]["difficulty"] == "medium"
        assert result["metadata"]["category"] == "algorithms"

def test_evaluate_solution_success():
    with patch('openai.chat.completions.create') as mock_create:
        # Mock the OpenAI response
        mock_create.return_value.choices = [
            type('obj', (), {'message': type('obj', (), {'content': 'Test feedback'})})()
        ]
        
        result = InterviewService.evaluate_solution(
            code="def test(): pass",
            question="Write a test function",
            language="python"
        )
        
        assert result["success"] is True
        assert "feedback" in result

def test_generate_question_failure():
    with patch('openai.chat.completions.create') as mock_create:
        mock_create.side_effect = Exception("API Error")
        
        result = InterviewService.generate_question(
            job_role="Software Engineer"
        )
        
        assert result["success"] is False
        assert "error" in result

def test_evaluate_solution_failure():
    with patch('openai.chat.completions.create') as mock_create:
        mock_create.side_effect = Exception("API Error")
        
        result = InterviewService.evaluate_solution(
            code="def test(): pass",
            question="Write a test function",
            language="python"
        )
        
        assert result["success"] is False
        assert "error" in result 