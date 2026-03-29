"use client";

import { useState, type KeyboardEvent } from "react";
import "./NewChatView.scss";

const suggestions = [
  {
    color: "primary" as const,
    title: "Explore quantum entanglement",
    description: "Map visual nodes for subatomic structures",
  },
  {
    color: "secondary" as const,
    title: "Analyze logic nodes",
    description: "Audit recursive functions in neural trees",
  },
  {
    color: "tertiary" as const,
    title: "Review archive logs",
    description: "Synthesize conclusions from past threads",
  },
  {
    color: "primary" as const,
    title: "Global thought network",
    description: "Connect with external data streams",
  },
];

interface NewChatViewProps {
  onSubmit: (text: string) => void;
}

export default function NewChatView({ onSubmit }: NewChatViewProps) {
  const [input, setInput] = useState("");

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="new-chat">
      <div className="new-chat__hero">
        <div className="new-chat__icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="5" fill="#69f6b8" opacity="0.8" />
            <circle cx="20" cy="8" r="2.5" fill="#69f6b8" opacity="0.5" />
            <circle cx="30" cy="28" r="2.5" fill="#69f6b8" opacity="0.5" />
            <circle cx="10" cy="28" r="2.5" fill="#69f6b8" opacity="0.5" />
            <line x1="20" y1="15" x2="20" y2="10.5" stroke="#69f6b8" strokeWidth="1.5" opacity="0.3" />
            <line x1="24" y1="23" x2="28" y2="26.5" stroke="#69f6b8" strokeWidth="1.5" opacity="0.3" />
            <line x1="16" y1="23" x2="12" y2="26.5" stroke="#69f6b8" strokeWidth="1.5" opacity="0.3" />
          </svg>
        </div>
        <h1 className="new-chat__title">Initiate Thought</h1>
        <p className="new-chat__subtitle">
          The system is ready to synthesize your inputs.
        </p>
      </div>

      <div className="new-chat__input-container">
        <textarea
          className="new-chat__textarea"
          placeholder="Inject a new thought branch..."
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="new-chat__input-toolbar">
          <div className="new-chat__toolbar-actions">
            <button className="new-chat__toolbar-btn" type="button" aria-label="Attach file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button className="new-chat__toolbar-btn" type="button" aria-label="Add image">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </button>
            <button className="new-chat__toolbar-btn" type="button" aria-label="Insert code">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
          </div>
          <button
            className="new-chat__branch-btn"
            type="button"
            aria-label="Submit"
            onClick={handleSubmit}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="new-chat__suggestions">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            className="new-chat__suggestion-card"
            type="button"
            onClick={() => onSubmit(suggestion.title)}
          >
            <div className={`new-chat__suggestion-dot new-chat__suggestion-dot--${suggestion.color}`} />
            <div className="new-chat__suggestion-text">
              <span className="new-chat__suggestion-title">{suggestion.title}</span>
              <span className="new-chat__suggestion-desc">{suggestion.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
