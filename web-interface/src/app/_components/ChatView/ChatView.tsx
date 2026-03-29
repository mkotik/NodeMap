"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { UIMessage, ChatStatus } from "ai";
import Markdown from "react-markdown";
import "./ChatView.scss";

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

interface ChatViewProps {
  messages: UIMessage[];
  status: ChatStatus;
  onSend: (text: string) => void;
}

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function getLabel(role: string, index: number): string {
  if (role === "assistant") return "Neural Logic";
  return index === 0 ? "User Request" : "Follow Up";
}

export default function ChatView({ messages, status, onSend }: ChatViewProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || (!isEmpty && isStreaming)) return;
    onSend(trimmed);
    setInput("");
  }

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (isEmpty) {
    return (
      <div className="chat-view">
        <div className="chat-view__hero">
          <div className="chat-view__icon">
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
          <h1 className="chat-view__title">Initiate Thought</h1>
          <p className="chat-view__subtitle">
            The system is ready to synthesize your inputs.
          </p>
        </div>

        <div className="chat-view__input-container">
          <textarea
            className="chat-view__textarea"
            placeholder="Inject a new thought branch..."
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
          />
          <div className="chat-view__input-toolbar">
            <div className="chat-view__toolbar-actions">
              <button className="chat-view__toolbar-btn" type="button" aria-label="Attach file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <button className="chat-view__toolbar-btn" type="button" aria-label="Add image">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </button>
              <button className="chat-view__toolbar-btn" type="button" aria-label="Insert code">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </button>
            </div>
            <button
              className="chat-view__branch-btn"
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

        <div className="chat-view__suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.title}
              className="chat-view__suggestion-card"
              type="button"
              onClick={() => onSend(suggestion.title)}
            >
              <div className={`chat-view__suggestion-dot chat-view__suggestion-dot--${suggestion.color}`} />
              <div className="chat-view__suggestion-text">
                <span className="chat-view__suggestion-title">{suggestion.title}</span>
                <span className="chat-view__suggestion-desc">{suggestion.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view-thread">
      <div className="chat-view-thread__messages">
        <div className="chat-view-thread__messages-inner">
          {messages.map((msg, i) => {
            const isAi = msg.role === "assistant";
            const text = getMessageText(msg);

            return (
              <div
                key={msg.id}
                className={`chat-view-thread__message chat-view-thread__message--${isAi ? "ai" : "user"}`}
              >
                <div className="chat-view-thread__node">
                  <div
                    className={`chat-view-thread__node-dot chat-view-thread__node-dot--${isAi ? "primary" : "muted"}`}
                  />
                </div>
                <div className="chat-view-thread__message-body">
                  <span
                    className={`chat-view-thread__label chat-view-thread__label--${isAi ? "ai" : "user"}`}
                  >
                    {getLabel(msg.role, i)}
                  </span>
                  <div
                    className={`chat-view-thread__bubble chat-view-thread__bubble--${isAi ? "ai" : "user"}`}
                  >
                    {text ? (
                      isAi ? (
                        <div className="chat-view-thread__markdown">
                          <Markdown>{text}</Markdown>
                        </div>
                      ) : (
                        <p>{text}</p>
                      )
                    ) : isAi && isStreaming ? (
                      <p className="chat-view-thread__typing">Thinking...</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-view-thread__input-bar">
        <div className="chat-view-thread__input-container">
          <div className="chat-view-thread__node-dot chat-view-thread__node-dot--primary" />
          <input
            className="chat-view-thread__input"
            type="text"
            placeholder="Inject a new thought branch..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <button
            className="chat-view-thread__submit-btn"
            type="button"
            aria-label="Submit"
            onClick={handleSubmit}
            disabled={isStreaming}
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
        <span className="chat-view-thread__hint">
          Press Cmd + Enter to expand branch
        </span>
      </div>
    </div>
  );
}
