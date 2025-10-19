from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()  # reads .env file
openai_api_key = os.getenv("OPENAI_API_KEY")
github_token = os.getenv("GITHUB_TOKEN")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Hello from ProjectLister backend!"}
