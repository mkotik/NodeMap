"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type DragEvent,
  type ChangeEvent,
} from "react";
import type { UIMessage, ChatStatus } from "ai";
import type { Branch } from "@/types/branch";
import {
  getMessageText,
  getMessageAttachments,
  getLabel,
  isImageType,
  isNativeFileType,
  type Attachment,
} from "@/lib/messages";
import { models } from "@/lib/models";
import { getAccessToken } from "@/lib/auth-token";
import Markdown from "react-markdown";
import { Tooltip } from "@/components";
import {
  ArrowRight,
  GitBranch,
  ChevronDown,
  Paperclip,
  X,
  FileText,
  Loader2,
} from "lucide-react";
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

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml",
];

const ACCEPT_STRING = ALLOWED_TYPES.join(",");
const MAX_FILES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_DOC_SIZE = 20 * 1024 * 1024;

interface PendingAttachment {
  id: string;
  file: File;
  url?: string;
  uploading: boolean;
  extractedText?: string;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatViewProps {
  messages: UIMessage[];
  status: ChatStatus;
  onSend: (
    text: string,
    attachments?: Array<Attachment & { extractedText?: string }>,
  ) => void;
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
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const hasUploading = attachments.some((a) => a.uploading);

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

  // --- File upload logic ---
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const uploadFile = useCallback(
    async (pending: PendingAttachment) => {
      try {
        // 1. Get presigned URL
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            filename: pending.file.name,
            contentType: pending.file.type,
            size: pending.file.size,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(err.message || "Failed to get upload URL");
        }

        const { uploadUrl, readUrl } = await presignRes.json();

        // 2. Upload to E2
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": pending.file.type },
          body: pending.file,
        });

        if (!uploadRes.ok) {
          throw new Error("Upload to storage failed");
        }

        // 3. Extract text only for non-native types (txt, csv, etc.)
        //    Images and PDFs are sent directly as file parts to the model.
        let extractedText: string | undefined;
        if (!isNativeFileType(pending.file.type)) {
          const extractRes = await fetch("/api/upload/extract", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              url: readUrl,
              mediaType: pending.file.type,
            }),
          });
          if (extractRes.ok) {
            const data = await extractRes.json();
            if (data.text) extractedText = data.text;
          }
        }

        // 4. Update state
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === pending.id
              ? { ...a, url: readUrl, uploading: false, extractedText }
              : a,
          ),
        );
      } catch (err) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === pending.id
              ? {
                  ...a,
                  uploading: false,
                  error:
                    err instanceof Error ? err.message : "Upload failed",
                }
              : a,
          ),
        );
      }
    },
    [getAuthHeaders],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remaining = MAX_FILES - attachments.length;

      if (remaining <= 0) {
        setAttachmentWarning(`Maximum ${MAX_FILES} files allowed.`);
        setTimeout(() => setAttachmentWarning(null), 3000);
        return;
      }

      if (fileArray.length > remaining) {
        setAttachmentWarning(`Maximum ${MAX_FILES} files allowed. Only adding ${remaining}.`);
        setTimeout(() => setAttachmentWarning(null), 3000);
      }

      const toAdd = fileArray.slice(0, remaining);

      const newAttachments: PendingAttachment[] = [];

      for (const file of toAdd) {
        // Validate type
        if (!ALLOWED_TYPES.includes(file.type)) continue;

        // Validate size
        const maxSize = isImageType(file.type)
          ? MAX_IMAGE_SIZE
          : MAX_DOC_SIZE;
        if (file.size > maxSize) continue;

        const pending: PendingAttachment = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          uploading: true,
        };
        newAttachments.push(pending);
      }

      if (newAttachments.length === 0) return;

      setAttachments((prev) => [...prev, ...newAttachments]);

      // Start uploads
      for (const pending of newAttachments) {
        uploadFile(pending);
      }
    },
    [attachments.length, uploadFile],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files);
        e.target.value = ""; // Reset so same file can be re-selected
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  function handleSubmit() {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || (!isEmpty && isStreaming))
      return;
    if (hasUploading) return;

    const readyAttachments = attachments
      .filter((a) => a.url && !a.error)
      .map((a) => ({
        url: a.url!,
        filename: a.file.name,
        mediaType: a.file.type,
        size: a.file.size,
        extractedText: a.extractedText,
      }));

    onSend(trimmed, readyAttachments.length > 0 ? readyAttachments : undefined);
    setInput("");
    setAttachments([]);
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

  // Shared attachment strip component
  const attachmentStrip = attachments.length > 0 && (
    <div className="chat-view__attachments">
      {attachments.map((att) => (
        <div
          key={att.id}
          className={`chat-view__attachment-chip${att.error ? " chat-view__attachment-chip--error" : ""}`}
        >
          {att.uploading ? (
            <Loader2 size={14} className="chat-view__attachment-spinner" />
          ) : isImageType(att.file.type) ? (
            <img
              src={att.url || URL.createObjectURL(att.file)}
              alt={att.file.name}
              className="chat-view__attachment-thumb"
            />
          ) : (
            <FileText size={14} />
          )}
          <span className="chat-view__attachment-name">
            {att.file.name}
          </span>
          <span className="chat-view__attachment-size">
            {formatFileSize(att.file.size)}
          </span>
          <button
            type="button"
            className="chat-view__attachment-remove"
            onClick={() => removeAttachment(att.id)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );

  // Hidden file input shared between both views
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept={ACCEPT_STRING}
      onChange={handleFileChange}
      style={{ display: "none" }}
    />
  );

  if (isEmpty) {
    return (
      <div
        className={`chat-view${dragging ? " chat-view--dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {fileInput}
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
            {attachmentStrip}
            <button
              className="chat-view__toolbar-btn"
              type="button"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} />
            </button>
            <div className="chat-view__model-selector" ref={modelRef}>
              <button
                className="chat-view__model-trigger"
                type="button"
                onClick={() => setModelOpen((o) => !o)}
              >
                <span className="chat-view__model-label">
                  {activeModel.label}
                </span>
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
                      <span className="chat-view__model-option-label">
                        {m.label}
                      </span>
                      <span className="chat-view__model-option-provider">
                        {m.provider}
                      </span>
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
              disabled={hasUploading}
            >
              <ArrowRight size={18} strokeWidth={2.5} />
            </button>
          </div>
          {attachmentWarning && (
            <p className="chat-view__attachment-warning">{attachmentWarning}</p>
          )}
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

        {dragging && (
          <div className="chat-view__drop-overlay">
            <Paperclip size={32} />
            <span>Drop files to attach</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`chat-view-thread${dragging ? " chat-view-thread--dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {fileInput}
      <div className="chat-view-thread__messages">
        <div className="chat-view-thread__messages-inner">
          {messages.map((msg, i) => {
            const isAi = msg.role === "assistant";
            const text = getMessageText(msg);
            const msgAttachments = getMessageAttachments(msg);

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
                    {/* Render inline attachments for user messages */}
                    {!isAi && msgAttachments.length > 0 && (
                      <div className="chat-view-thread__msg-attachments">
                        {msgAttachments.map((att, idx) =>
                          isImageType(att.mediaType) ? (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="chat-view-thread__msg-image-link"
                            >
                              <img
                                src={att.url}
                                alt={att.filename}
                                className="chat-view-thread__msg-image"
                              />
                            </a>
                          ) : (
                            <div
                              key={idx}
                              className="chat-view-thread__msg-file-chip"
                            >
                              <FileText size={14} />
                              <span>{att.filename}</span>
                            </div>
                          ),
                        )}
                      </div>
                    )}
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
              </div>
            );
          })}
          {isStreaming && messages.length > 0 && messages[messages.length - 1].role === "user" && (
            <div className="chat-view-thread__message chat-view-thread__message--ai">
              <div className="chat-view-thread__node">
                <div className="chat-view-thread__node-dot chat-view-thread__node-dot--primary" />
              </div>
              <div className="chat-view-thread__message-body">
                <div className="chat-view-thread__label-row">
                  <span className="chat-view-thread__label chat-view-thread__label--ai">
                    Assistant
                  </span>
                </div>
                <div className="chat-view-thread__bubble chat-view-thread__bubble--ai">
                  <div className="chat-view-thread__thinking-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-view-thread__input-bar">
        {attachmentStrip}
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
            className="chat-view__toolbar-btn"
            type="button"
            aria-label="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={16} />
          </button>
          <button
            className="chat-view-thread__submit-btn"
            type="button"
            aria-label="Submit"
            onClick={handleSubmit}
            disabled={isStreaming || hasUploading}
          >
            <ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="chat-view-thread__hint-row">
          <div
            className="chat-view__model-selector chat-view__model-selector--compact"
            ref={modelRef}
          >
            <button
              className="chat-view__model-trigger"
              type="button"
              onClick={() => setModelOpen((o) => !o)}
            >
              <span className="chat-view__model-label">
                {activeModel.label}
              </span>
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
                    <span className="chat-view__model-option-label">
                      {m.label}
                    </span>
                    <span className="chat-view__model-option-provider">
                      {m.provider}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="chat-view-thread__hint">Press Enter to send</span>
        </div>
      </div>

      {dragging && (
        <div className="chat-view__drop-overlay">
          <Paperclip size={32} />
          <span>Drop files to attach</span>
        </div>
      )}
    </div>
  );
}
