"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { UIMessage, ChatStatus } from "ai";
import Markdown from "react-markdown";
import "./ThreadView.scss";

interface ThreadViewProps {
  messages: UIMessage[];
  status: ChatStatus;
  onSend: (text: string) => void;
}

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getLabel(role: string, index: number): string {
  if (role === "assistant") return "Neural Logic";
  return index === 0 ? "User Request" : "Follow Up";
}

export default function ThreadView({ messages, status, onSend }: ThreadViewProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
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
          {messages.map((msg, i) => {
            const isAi = msg.role === "assistant";
            const text = getMessageText(msg);

            return (
              <div
                key={msg.id}
                className={`thread__message thread__message--${isAi ? "ai" : "user"}`}
              >
                <div className="thread__node">
                  <div
                    className={`thread__node-dot thread__node-dot--${isAi ? "primary" : "muted"}`}
                  />
                </div>
                <div className="thread__message-body">
                  <span
                    className={`thread__label thread__label--${isAi ? "ai" : "user"}`}
                  >
                    {getLabel(msg.role, i)}
                  </span>
                  <div
                    className={`thread__bubble thread__bubble--${isAi ? "ai" : "user"}`}
                  >
                    {text ? (
                      isAi ? (
                        <div className="thread__markdown"><Markdown>{text}</Markdown></div>
                      ) : (
                        <p>{text}</p>
                      )
                    ) : isAi && isStreaming ? (
                      <p className="thread__typing">Thinking...</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
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
        <span className="thread__hint">
          Press Cmd + Enter to expand branch
        </span>
      </div>
    </div>
  );
}
