"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Depends, Cookie
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
import os
from pathlib import Path
import json
from typing import Optional
from datetime import datetime, timedelta
import secrets

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# Session management
sessions = {}  # {token: {"email": "...", "role": "...", "expires": datetime}}

# Load users from JSON file
def load_users():
    users_file = os.path.join(Path(__file__).parent, "users.json")
    with open(users_file, "r") as f:
        return json.load(f)["users"]

# Authentication helper
def get_current_user(auth_token: Optional[str] = Cookie(None)):
    """Validate session token and return user info"""
    if not auth_token or auth_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_data = sessions[auth_token]
    if datetime.now() > session_data["expires"]:
        del sessions[auth_token]
        raise HTTPException(status_code=401, detail="Session expired")
    
    return session_data

# Role-based access control
def require_role(*allowed_roles):
    """Decorator to check if user has required role"""
    def role_checker(user = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


# Authentication Endpoints
@app.post("/auth/login")
def login(email: str, password: str):
    """Login endpoint"""
    users = load_users()
    
    if email not in users:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = users[email]
    if user["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session token
    token = secrets.token_urlsafe(32)
    sessions[token] = {
        "email": email,
        "role": user["role"],
        "full_name": user["full_name"],
        "expires": datetime.now() + timedelta(hours=24)
    }
    
    response = JSONResponse({
        "message": "Logged in successfully",
        "user": {
            "email": email,
            "role": user["role"],
            "full_name": user["full_name"]
        }
    })
    response.set_cookie("auth_token", token, httponly=True, max_age=86400)
    return response


@app.post("/auth/logout")
def logout(user = Depends(get_current_user)):
    """Logout endpoint"""
    # Find and delete the user's session
    for token, session in list(sessions.items()):
        if session["email"] == user["email"]:
            del sessions[token]
            break
    
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie("auth_token")
    return response


@app.post("/auth/register")
def register(email: str, password: str, full_name: str):
    """Register a new student account"""
    users = load_users()
    
    if email in users:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Add new user with student role
    users[email] = {
        "password": password,
        "role": "student",
        "full_name": full_name
    }
    
    # Save updated users to file
    users_file = os.path.join(Path(__file__).parent, "users.json")
    with open(users_file, "w") as f:
        json.dump({"users": users}, f, indent=2)
    
    return {"message": "Registration successful. Please log in."}


@app.get("/auth/me")
def get_me(user = Depends(get_current_user)):
    """Get current user information"""
    return {
        "email": user["email"],
        "role": user["role"],
        "full_name": user["full_name"]
    }


@app.get("/activities")
def get_activities(user: Optional[dict] = None):
    """Get all activities - public endpoint"""
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, user = Depends(get_current_user)):
    """Sign up a student for an activity (authentication required)"""
    # Only students and club heads can sign up
    if user["role"] not in ["student", "club_head"]:
        raise HTTPException(status_code=403, detail="Only students can sign up")
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]
    
    # Check if activity is full
    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(status_code=400, detail="Activity is full")

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, user = Depends(get_current_user)):
    """Unregister a student from an activity (authentication required)"""
    # Faculty and Admins can unregister anyone, others only themselves
    if user["role"] not in ["faculty", "admin"] and user["email"] != email:
        raise HTTPException(status_code=403, detail="Cannot unregister others")
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
