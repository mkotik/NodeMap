"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import "./login.scss";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, loginWithGoogle } = useAuth();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const [isRegister, setIsRegister] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      setError("");
      try {
        await loginWithGoogle(response.credential);
        router.push("/");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Google sign-in failed.",
        );
      }
    },
    [loginWithGoogle, router],
  );

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const w = window as unknown as Record<string, unknown>;
      const google = w.google as {
        accounts: {
          id: {
            initialize: (config: Record<string, unknown>) => void;
            renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
          };
        };
      };

      google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      if (googleBtnRef.current) {
        google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          width: googleBtnRef.current.offsetWidth,
          text: "continue_with",
        });
      }
    };
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [handleCredentialResponse]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(firstName, lastName, email, password);
      } else {
        await login(email, password);
      }
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-login">
      <div className="auth-login__card">
        <div className="auth-login__header">
          <h1 className="auth-login__logo">NodeMap.io</h1>
          <h2 className="auth-login__title">
            {isRegister ? "Create your account" : "Sign in to NodeMap.io"}
          </h2>
        </div>

        <form className="auth-login__form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="auth-login__name-row">
              <div className="auth-login__field">
                <label className="auth-login__label" htmlFor="firstName">
                  First Name
                </label>
                <input
                  className="auth-login__input"
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="auth-login__field">
                <label className="auth-login__label" htmlFor="lastName">
                  Last Name
                </label>
                <input
                  className="auth-login__input"
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
          )}

          <div className="auth-login__field">
            <label className="auth-login__label" htmlFor="email">
              Email
            </label>
            <input
              className="auth-login__input"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-login__field">
            <label className="auth-login__label" htmlFor="password">
              Password
            </label>
            <input
              className="auth-login__input"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {error && <p className="auth-login__error">{error}</p>}

          <button
            className="auth-login__submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <div className="auth-login__divider">
          <span>or</span>
        </div>

        <div ref={googleBtnRef} className="auth-login__google-btn" />

        <p className="auth-login__toggle">
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            className="auth-login__toggle-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
