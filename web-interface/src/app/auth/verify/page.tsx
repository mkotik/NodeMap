"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle, XCircle } from "lucide-react";
import "./verify.scss";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="verify-page"><div className="verify-page__card"><p className="verify-page__text">Loading...</p></div></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { markEmailVerified } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token provided.");
      return;
    }

    trpc.auth.verifyEmail
      .mutate({ token })
      .then(() => {
        setStatus("success");
        markEmailVerified();
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Invalid or expired verification link.",
        );
      });
  }, [token, markEmailVerified]);

  return (
    <div className="verify-page">
      <div className="verify-page__card">
        {status === "loading" && (
          <p className="verify-page__text">Verifying your email...</p>
        )}
        {status === "success" && (
          <>
            <CheckCircle size={40} className="verify-page__icon verify-page__icon--success" />
            <h2 className="verify-page__title">Email verified!</h2>
            <p className="verify-page__text">
              Your email has been verified. You can now start chatting.
            </p>
            <a href="/" className="verify-page__link">
              Go to chat
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={40} className="verify-page__icon verify-page__icon--error" />
            <h2 className="verify-page__title">Verification failed</h2>
            <p className="verify-page__text">{errorMsg}</p>
            <a href="/" className="verify-page__link">
              Go back
            </a>
          </>
        )}
      </div>
    </div>
  );
}
