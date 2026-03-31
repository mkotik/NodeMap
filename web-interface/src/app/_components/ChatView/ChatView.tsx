"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { UIMessage, ChatStatus } from "ai";
import type { Branch } from "@/types/branch";
import { getMessageText, getLabel } from "@/lib/messages";
import { models, type Model } from "@/lib/models";
import Markdown from "react-markdown";
import { Tooltip } from "@/components";
import { ArrowRight, GitBranch, ChevronDown } from "lucide-react";
import "./ChatView.scss";

const suggestions = [
  {
    color: "primary" as const,
    title: "Help me brainstorm ideas",
    description: "Explore a topic from multiple angles",
  },
  {
    color: "secondary" as const,
    title: "Explain a concept",
    description: "Break down something complex step by step",
  },
  {
    color: "tertiary" as const,
    title: "Help me write something",
    description: "Draft an email, essay, or message",
  },
  {
    color: "primary" as const,
    title: "Analyze a problem",
    description: "Work through a challenge together",
  },
];

interface ChatViewProps {
  messages: UIMessage[];
  status: ChatStatus;
  onSend: (text: string) => void;
  activeBranch: Branch;
  onCreateBranch: (fromMessageId: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export default function ChatView({
  messages,
  status,
  onSend,
  activeBranch,
  onCreateBranch,
  selectedModel,
  onModelChange,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const activeModel = models.find((m) => m.id === selectedModel) ?? models[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isStreaming = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isEmpty) {
      textareaRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [isEmpty, messages.length, activeBranch.id]);

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
              <line
                x1="20"
                y1="15"
                x2="20"
                y2="10.5"
                stroke="#69f6b8"
                strokeWidth="1.5"
                opacity="0.3"
              />
              <line
                x1="24"
                y1="23"
                x2="28"
                y2="26.5"
                stroke="#69f6b8"
                strokeWidth="1.5"
                opacity="0.3"
              />
              <line
                x1="16"
                y1="23"
                x2="12"
                y2="26.5"
                stroke="#69f6b8"
                strokeWidth="1.5"
                opacity="0.3"
              />
            </svg>
          </div>
          <h1 className="chat-view__title">Start a conversation</h1>
          <p className="chat-view__subtitle">Ask anything to get started.</p>
        </div>

        <div className="chat-view__input-container">
          <textarea
            ref={textareaRef}
            className="chat-view__textarea"
            placeholder="Type your message..."
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
          />
          <div className="chat-view__input-toolbar">
            <div className="chat-view__model-selector" ref={modelRef}>
              <button
                className="chat-view__model-trigger"
                type="button"
                onClick={() => setModelOpen((o) => !o)}
              >
                <span className="chat-view__model-label">{activeModel.label}</span>
                <ChevronDown size={14} />
              </button>
              {modelOpen && (
                <div className="chat-view__model-dropdown">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      className={`chat-view__model-option${m.id === selectedModel ? " chat-view__model-option--active" : ""}`}
                      type="button"
                      onClick={() => {
                        onModelChange(m.id);
                        setModelOpen(false);
                      }}
                    >
                      <span className="chat-view__model-option-label">{m.label}</span>
                      <span className="chat-view__model-option-provider">{m.provider}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="chat-view__branch-btn"
              type="button"
              aria-label="Submit"
              onClick={handleSubmit}
            >
              <ArrowRight size={18} strokeWidth={2.5} />
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
              <div
                className={`chat-view__suggestion-dot chat-view__suggestion-dot--${suggestion.color}`}
              />
              <div className="chat-view__suggestion-text">
                <span className="chat-view__suggestion-title">
                  {suggestion.title}
                </span>
                <span className="chat-view__suggestion-desc">
                  {suggestion.description}
                </span>
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
                  <div className="chat-view-thread__label-row">
                    <span
                      className={`chat-view-thread__label chat-view-thread__label--${isAi ? "ai" : "user"}`}
                    >
                      {getLabel(msg.role, i)}
                    </span>
                    {isAi && !isStreaming && (
                      <Tooltip text="Branch from here">
                        <button
                          className="chat-view-thread__branch-action"
                          type="button"
                          onClick={() => onCreateBranch(msg.id)}
                        >
                          <GitBranch size={14} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
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
            ref={inputRef}
            className="chat-view-thread__input"
            type="text"
            placeholder="Type your message..."
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
            <ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="chat-view-thread__hint-row">
          <div className="chat-view__model-selector chat-view__model-selector--compact" ref={modelRef}>
            <button
              className="chat-view__model-trigger"
              type="button"
              onClick={() => setModelOpen((o) => !o)}
            >
              <span className="chat-view__model-label">{activeModel.label}</span>
              <ChevronDown size={14} />
            </button>
            {modelOpen && (
              <div className="chat-view__model-dropdown">
                {models.map((m) => (
                  <button
                    key={m.id}
                    className={`chat-view__model-option${m.id === selectedModel ? " chat-view__model-option--active" : ""}`}
                    type="button"
                    onClick={() => {
                      onModelChange(m.id);
                      setModelOpen(false);
                    }}
                  >
                    <span className="chat-view__model-option-label">{m.label}</span>
                    <span className="chat-view__model-option-provider">{m.provider}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="chat-view-thread__hint">Press Enter to send</span>
        </div>
      </div>
    </div>
  );
}
