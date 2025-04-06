import tkinter as tk
from tkinter import ttk, scrolledtext
import requests
import json
import markdown
from datetime import datetime

class InterviewApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Technical Interview App")
        self.root.geometry("1200x800")
        
        # State variables
        self.current_question = None
        self.job_role = tk.StringVar(value="AI Developer")
        self.difficulty = tk.StringVar(value="medium")
        self.api_url = "http://localhost:5000/api"
        
        self.setup_ui()
        self.check_backend()
        self.generate_question()
        
    def setup_ui(self):
        # Create main container with two columns
        main_container = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left panel (Question and Code Editor)
        left_panel = ttk.Frame(main_container)
        main_container.add(left_panel, weight=1)
        
        # Job Role and Difficulty
        controls_frame = ttk.Frame(left_panel)
        controls_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(controls_frame, text="Job Role:").pack(side=tk.LEFT, padx=5)
        ttk.Entry(controls_frame, textvariable=self.job_role).pack(side=tk.LEFT, padx=5)
        
        ttk.Label(controls_frame, text="Difficulty:").pack(side=tk.LEFT, padx=5)
        difficulty_combo = ttk.Combobox(controls_frame, textvariable=self.difficulty, 
                                      values=["easy", "medium", "hard"])
        difficulty_combo.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(controls_frame, text="Generate Question", 
                  command=self.generate_question).pack(side=tk.LEFT, padx=5)
        
        # Question Display
        question_frame = ttk.LabelFrame(left_panel, text="Coding Problem")
        question_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.question_text = scrolledtext.ScrolledText(question_frame, wrap=tk.WORD, 
                                                     height=10, font=("Courier", 10))
        self.question_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Code Editor
        editor_frame = ttk.LabelFrame(left_panel, text="Code Editor")
        editor_frame.pack(fill=tk.BOTH, expand=True)
        
        self.code_editor = scrolledtext.ScrolledText(editor_frame, wrap=tk.NONE, 
                                                   font=("Courier", 12))
        self.code_editor.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        ttk.Button(left_panel, text="Submit Solution", 
                  command=self.submit_solution).pack(pady=10)
        
        # Right panel (Chat)
        right_panel = ttk.Frame(main_container)
        main_container.add(right_panel, weight=1)
        
        # Chat Display
        chat_frame = ttk.LabelFrame(right_panel, text="Interview Chat")
        chat_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.chat_display = scrolledtext.ScrolledText(chat_frame, wrap=tk.WORD, 
                                                    font=("Arial", 10))
        self.chat_display.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Message Input
        input_frame = ttk.Frame(right_panel)
        input_frame.pack(fill=tk.X)
        
        self.message_input = ttk.Entry(input_frame)
        self.message_input.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        self.message_input.bind("<Return>", lambda e: self.send_message())
        
        ttk.Button(input_frame, text="Send", 
                  command=self.send_message).pack(side=tk.RIGHT)
    
    def check_backend(self):
        try:
            response = requests.get(f"{self.api_url}/health")
            if response.status_code == 200:
                self.add_message("System", "Connected to backend server successfully!")
            else:
                self.add_message("System", "Backend server returned an error.")
        except requests.RequestException:
            self.add_message("System", "Could not connect to backend server. Please ensure it's running.")
    
    def generate_question(self):
        try:
            response = requests.post(
                f"{self.api_url}/generate-question",
                json={"job_role": self.job_role.get(), "difficulty": self.difficulty.get()}
            )
            if response.status_code == 200:
                data = response.json()
                self.current_question = data
                self.question_text.delete(1.0, tk.END)
                self.question_text.insert(tk.END, data["question"])
                self.add_message("System", "New question generated!")
            else:
                self.add_message("System", "Error generating question.")
        except requests.RequestException as e:
            self.add_message("System", f"Error: {str(e)}")
    
    def submit_solution(self):
        if not self.current_question:
            self.add_message("System", "No question to evaluate!")
            return
        
        try:
            response = requests.post(
                f"{self.api_url}/evaluate-solution",
                json={
                    "code": self.code_editor.get(1.0, tk.END).strip(),
                    "question": self.current_question["question"],
                    "language": "python"
                }
            )
            if response.status_code == 200:
                data = response.json()
                self.add_message("Evaluator", data["feedback"])
            else:
                self.add_message("System", "Error evaluating solution.")
        except requests.RequestException as e:
            self.add_message("System", f"Error: {str(e)}")
    
    def send_message(self):
        message = self.message_input.get().strip()
        if not message:
            return
        
        self.add_message("You", message)
        self.message_input.delete(0, tk.END)
        
        try:
            response = requests.post(
                f"{self.api_url}/chat",
                json={
                    "message": message,
                    "context": {
                        "jobRole": self.job_role.get(),
                        "currentQuestion": self.current_question["question"] if self.current_question else None
                    }
                }
            )
            if response.status_code == 200:
                data = response.json()
                self.add_message("Interviewer", data["response"])
            else:
                self.add_message("System", "Error getting response from interviewer.")
        except requests.RequestException as e:
            self.add_message("System", f"Error: {str(e)}")
    
    def add_message(self, sender, content):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.insert(tk.END, f"\n[{timestamp}] {sender}:\n")
        
        # Convert markdown to text (basic support)
        content = markdown.markdown(content)
        
        # Add the message content
        self.chat_display.insert(tk.END, f"{content}\n")
        self.chat_display.see(tk.END)

if __name__ == "__main__":
    root = tk.Tk()
    app = InterviewApp(root)
    root.mainloop() 