"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Mail } from "lucide-react";
import "./VerifyBanner.scss";

export default function VerifyBanner() {
  const { user, resendVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified) return null;

  async function handleResend() {
    setSending(true);
    try {
      await resendVerification();
      setSent(true);
    } catch {
      // silently fail — user can retry
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="verify-banner">
      <div className="verify-banner__content">
        <Mail size={16} className="verify-banner__icon" />
        <span className="verify-banner__text">
          Please verify your email address to start chatting.
        </span>
        <button
          className="verify-banner__btn"
          type="button"
          onClick={handleResend}
          disabled={sending || sent}
        >
          {sent ? "Email sent!" : sending ? "Sending..." : "Resend verification email"}
        </button>
      </div>
    </div>
  );
}
