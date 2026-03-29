"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { Message } from "../../page";
import "./ThreadView.scss";

interface ThreadViewProps {
  messages: Message[];
  onSubmit: (text: string) => void;
}

export default function ThreadView({ messages, onSubmit }: ThreadViewProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="thread">
      <div className="thread__messages">
        <div className="thread__messages-inner">
          {messages.map((msg) => (
            <div key={msg.id} className={`thread__message thread__message--${msg.role}`}>
              <div className="thread__node">
                <div className={`thread__node-dot thread__node-dot--${msg.role === "ai" ? "primary" : "muted"}`} />
              </div>
              <div className="thread__message-body">
                <span className={`thread__label thread__label--${msg.role}`}>
                  {msg.label}
                </span>
                <div className={`thread__bubble thread__bubble--${msg.role}`}>
                  <p>{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="thread__input-bar">
        <div className="thread__input-container">
          <div className="thread__node-dot thread__node-dot--primary" />
          <input
            className="thread__input"
            type="text"
            placeholder="Inject a new thought branch..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="thread__submit-btn"
            type="button"
            aria-label="Submit"
            onClick={handleSubmit}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <span className="thread__hint">
          Press Cmd + Enter to expand branch
        </span>
      </div>
    </div>
  );
}
