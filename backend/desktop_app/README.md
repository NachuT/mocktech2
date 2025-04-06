# Technical Interview Desktop App

This is a desktop version of the technical interview application built using Python's Tkinter library. It provides a native interface for conducting technical interviews, with features like:

- Code editor with syntax highlighting
- Real-time chat with the AI interviewer
- Question generation based on job role and difficulty
- Solution evaluation with feedback

## Prerequisites

- Python 3.x
- Virtual environment (recommended)
- Backend server running on `http://localhost:5000`

## Installation

1. Create and activate a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Unix/macOS
# or
.\venv\Scripts\activate  # On Windows
```

2. Install required packages:
```bash
pip install requests markdown
```

## Running the Application

1. Make sure the backend server is running on `http://localhost:5000`

2. Run the desktop app:
```bash
python main.py
```

## Features

- **Job Role Selection**: Specify the target job role for the interview
- **Difficulty Level**: Choose between easy, medium, and hard questions
- **Code Editor**: Write and submit your code solutions
- **Chat Interface**: Communicate with the AI interviewer
- **Real-time Feedback**: Get immediate feedback on your solutions

## Usage

1. Enter your desired job role and select the difficulty level
2. Click "Generate Question" to get a new coding problem
3. Write your solution in the code editor
4. Click "Submit Solution" to get feedback
5. Use the chat interface to ask questions or get clarifications

## Note

This desktop app requires the backend server to be running. Make sure to start the backend server before running this application. 