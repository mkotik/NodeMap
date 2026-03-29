import { type ButtonHTMLAttributes } from "react";
import styles from "./BranchButton.module.scss";

type BranchButtonVariant = "primary" | "ghost";

interface BranchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BranchButtonVariant;
}

export default function BranchButton({
  variant = "primary",
  className,
  children,
  ...props
}: BranchButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className ?? ""}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
