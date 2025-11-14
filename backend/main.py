from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
import os
import httpx
from openai import OpenAI

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

openai = OpenAI(api_key=OPENAI_API_KEY)

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


# --- SEARCH PROJECTS ---
@app.get("/search")
async def search_projects(
    q: str = Query(..., min_length=2),
    page: int = Query(1, ge=1),
    per_page: int = Query(5, ge=1, le=20),
):
    """
    Searches GitHub for relevant open-source projects based on a given idea.
    """
    # Add context awareness for better searches
    context_map = {
        "browser": "web browser OR browser engine OR rendering engine OR chromium OR servo",
        "ai": "artificial intelligence OR machine learning OR deep learning OR neural network",
        "database": "database engine OR storage system OR SQL OR NoSQL",
        "compiler": "compiler OR transpiler OR interpreter OR language processor",
        "os": "operating system OR kernel OR scheduler OR system call",
    }

    refined_term = context_map.get(q.lower(), q)
    refined_query = (
        f"{refined_term} in:name,description,readme stars:>50 fork:false"
    )

    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    params = {
        "q": refined_query,
        "sort": "stars",
        "order": "desc",
        "page": page,
        "per_page": per_page,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/search/repositories",
            headers=headers,
            params=params,
            timeout=30.0,
        )

    if response.status_code != 200:
        return {
            "error": f"GitHub API returned {response.status_code}",
            "details": response.text,
        }

    data = response.json()
    items = data.get("items", [])

    if not items:
        print(f" No results found for query: {refined_query}")
        return []

    results = [
        {
            "name": item["name"],
            "description": item["description"] or "No description available.",
            "url": item["html_url"],
        }
        for item in items
    ]
    print(f" Found {len(results)} results for '{q}'")

    return results


# --- SUMMARIZE REPO ---
@app.post("/summarize")
async def summarize_repo(repo: dict):
    prompt = (
        f"Summarize this GitHub project in 1–2 concise sentences for a developer audience:\n"
        f"Name: {repo['name']}\nDescription: {repo['description']}"
    )

    def get_summary():
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
        )
        return response.choices[0].message.content.strip()

    summary = await run_in_threadpool(get_summary)
    return {"summary": summary}


# --- CHATBOT ---
@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    user_message = data.get("message")
    if not user_message:
        return {"error": "Missing 'message' in request body"}

    def get_reply():
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI that explains GitHub projects and assists users in understanding open-source tools.",
                },
                {"role": "user", "content": user_message},
            ],
            max_tokens=150,
        )
        return response.choices[0].message.content.strip()

    reply = await run_in_threadpool(get_reply)
    return {"reply": reply}
