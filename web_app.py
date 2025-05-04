from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from poisim import JailbreakDetector
import uvicorn
import os

app = FastAPI(
    title="POIsim",
    description="AI Safety and Jailbreak Detection System",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the detector
detector = JailbreakDetector()

# Set up templates
templates = Jinja2Templates(directory="templates")

class TextRequest(BaseModel):
    text: str

class TextResponse(BaseModel):
    score: float
    nature: str
    explanation: str
    is_safe: bool

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/analyze", response_model=TextResponse)
async def analyze_text(request: TextRequest):
    try:
        result = detector.predict(request.text)
        return TextResponse(
            score=result.score,
            nature=result.nature,
            explanation=result.explanation,
            is_safe=result.score < 0.5
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 