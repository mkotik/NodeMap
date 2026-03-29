import { type ReactNode } from "react";
import styles from "./ChatNode.module.scss";

type ChatNodeVariant = "ai" | "user";

interface ChatNodeProps {
  children: ReactNode;
  variant?: ChatNodeVariant;
  className?: string;
}

export default function ChatNode({
  children,
  variant = "ai",
  className,
}: ChatNodeProps) {
  return (
    <div
      className={`${styles.node} ${styles[variant]} ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}
