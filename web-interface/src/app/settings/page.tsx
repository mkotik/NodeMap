"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { trpc } from "@/lib/trpc";
import BeatLoader from "react-spinners/BeatLoader";
import "./Settings.scss";

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }
    trpc.settings.getApiKey
      .query()
      .then((res) => {
        setHasKey(res.hasKey);
        setMaskedKey(res.maskedKey);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  async function handleSave() {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setSaving(true);
    setStatus(null);
    try {
      await trpc.settings.saveApiKey.mutate({ apiKey: trimmed });
      setHasKey(true);
      // Build masked preview locally
      const masked =
        trimmed.length > 12
          ? trimmed.slice(0, 8) + "..." + trimmed.slice(-4)
          : "***";
      setMaskedKey(masked);
      setApiKey("");
      setStatus({ type: "success", message: "API key saved" });
    } catch {
      setStatus({ type: "error", message: "Failed to save API key" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setStatus(null);
    try {
      await trpc.settings.removeApiKey.mutate();
      setHasKey(false);
      setMaskedKey(null);
      setApiKey("");
      setStatus({ type: "success", message: "API key removed" });
    } catch {
      setStatus({ type: "error", message: "Failed to remove API key" });
    } finally {
      setRemoving(false);
    }
  }

  if (!user && !authLoading) {
    return (
      <div className="settings settings--empty">
        <p className="settings__empty-text">
          Sign in to manage your settings.
        </p>
      </div>
    );
  }

  return (
    <div className="settings">
      <div className="settings__header">
        <h1 className="settings__title">Settings</h1>
      </div>

      <section className="settings__section">
        <h2 className="settings__section-title">OpenRouter API Key</h2>
        <p className="settings__section-desc">
          NodeMap uses{" "}
          <a
            href="https://openrouter.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="settings__link"
          >
            OpenRouter
          </a>{" "}
          to connect to LLMs. To get your API key:
        </p>
        <ol className="settings__steps">
          <li>
            Create an account at{" "}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="settings__link"
            >
              openrouter.ai
            </a>
          </li>
          <li>
            Go to{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="settings__link"
            >
              Keys
            </a>{" "}
            and create a new key
          </li>
          <li>Copy the key and paste it below</li>
        </ol>
        <p className="settings__section-desc settings__section-desc--muted">
          Your key is encrypted with AES-256-GCM before being stored and is
          never exposed in full after saving.
        </p>

        {loading ? (
          <div className="settings__loading">
            <BeatLoader color="#6d758c" size={6} />
          </div>
        ) : (
          <div className="settings__key-form">
            {hasKey && maskedKey && (
              <div className="settings__key-current">
                <span className="settings__key-label">Current key</span>
                <code className="settings__key-masked">{maskedKey}</code>
                <button
                  type="button"
                  className="settings__key-remove"
                  onClick={handleRemove}
                  disabled={removing}
                >
                  {removing ? (
                    <BeatLoader color="#ff716c" size={3} />
                  ) : (
                    "Remove"
                  )}
                </button>
              </div>
            )}

            <div className="settings__key-input-row">
              <input
                ref={inputRef}
                className="settings__key-input"
                type="password"
                placeholder={
                  hasKey ? "Enter new key to replace" : "sk-or-v1-..."
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                maxLength={500}
              />
              <button
                type="button"
                className="settings__key-save"
                onClick={handleSave}
                disabled={!apiKey.trim() || saving}
              >
                {saving ? (
                  <BeatLoader color="#69f6b8" size={3} />
                ) : hasKey ? (
                  "Replace"
                ) : (
                  "Save"
                )}
              </button>
            </div>

            {status && (
              <p
                className={`settings__status settings__status--${status.type}`}
              >
                {status.message}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
