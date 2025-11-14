"use client";
import { useState, useRef, useEffect } from "react";

interface Repo {
  name: string;
  description: string;
  url: string;
  summary?: string;
}

export default function Home() {
  const [projectIdea, setProjectIdea] = useState("");
  const [results, setResults] = useState<Repo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: "User" | "AI"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // --- SEARCH FUNCTION ---
  const handleSearch = async (isLoadMore = false) => {
    if (!projectIdea.trim()) return;
    setLoading(true);

    const currentPage = isLoadMore ? page + 1 : 1;

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/search?q=${encodeURIComponent(projectIdea)}&page=${currentPage}&per_page=6`
      );
      const data = await res.json();

      if (!Array.isArray(data)) {
        setResults([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      // Summarize each repo
      const summarized = await Promise.all(
        data.map(async (repo: Repo) => {
          const sumRes = await fetch("http://127.0.0.1:8000/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(repo),
          });
          const sumData = await sumRes.json();
          return { ...repo, summary: sumData.summary };
        })
      );

      // Append or replace results
      setResults(isLoadMore ? [...results, ...summarized] : summarized);
      setPage(currentPage);
      setHasMore(data.length > 0); // if GitHub returns results, assume there may be more
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // --- CHATBOT FUNCTION ---
  const handleChat = async (message: string) => {
    if (!message.trim()) return;

    setChatMessages((prev) => [...prev, { sender: "User", text: message }]);
    setChatInput("");

    try {
      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { sender: "AI", text: data.reply || "No reply" }]);
    } catch {
      setChatMessages((prev) => [...prev, { sender: "AI", text: "Error sending message." }]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-md py-4 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white font-bold flex items-center justify-center rounded-full text-xl shadow">
            IL
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-700">IdeaLens</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-8 sm:p-12 flex flex-col gap-12">
        {/* Search Section */}
        <section className="flex flex-col sm:flex-row gap-4 items-center">
          <input
            type="text"
            placeholder="Enter your project idea..."
            value={projectIdea}
            onChange={(e) => setProjectIdea(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-lg"
          />
          <button
            onClick={() => handleSearch(false)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium shadow-md text-lg"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </section>

        {/* Results Section */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.length === 0 && !loading && (
            <p className="text-gray-500 italic col-span-full">
              No results yet. Enter a project idea above.
            </p>
          )}

          {results.map((repo, idx) => (
            <div
              key={idx}
              className="bg-white p-6 rounded-xl shadow hover:shadow-xl transition flex flex-col gap-2 border border-gray-200"
            >
              <h2 className="font-semibold text-xl text-blue-700 hover:underline">
                <a href={repo.url} target="_blank" rel="noopener noreferrer">
                  {repo.name}
                </a>
              </h2>
              <p className="text-gray-700">{repo.description}</p>
              {repo.summary && (
                <p className="text-gray-900 mt-2 font-medium bg-gray-100 p-2 rounded">
                  {repo.summary}
                </p>
              )}
            </div>
          ))}
        </section>

        {/* Load More Button */}
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => handleSearch(true)}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium shadow-md"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}

        {/* Chatbot Section */}
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-blue-700">AI Assistant</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Chat messages */}
            <div className="flex-1 border border-gray-300 rounded-lg p-4 h-80 overflow-y-auto bg-white shadow-inner flex flex-col gap-2">
              {chatMessages.length === 0 && (
                <p className="text-gray-500 italic">Your AI assistant will appear here.</p>
              )}
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-xl max-w-xs ${
                    msg.sender === "User"
                      ? "bg-blue-600 text-white self-end"
                      : "bg-gray-200 text-gray-800 self-start"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex flex-col gap-2 w-full sm:w-80">
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleChat(chatInput);
                }}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-lg"
              />
              <button
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium shadow-md"
                onClick={() => handleChat(chatInput)}
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white shadow-inner py-4 px-8 text-center text-gray-500 text-sm">
        © 2025 IdeaLens. Crafted for innovators.
      </footer>
    </div>
  );
}


