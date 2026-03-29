import styles from "./NodePoint.module.scss";

type BranchColor = "primary" | "secondary" | "tertiary";

interface NodePointProps {
  color?: BranchColor;
  active?: boolean;
  className?: string;
}

export default function NodePoint({
  color = "primary",
  active = false,
  className,
}: NodePointProps) {
  return (
    <span
      className={`${styles.point} ${styles[color]} ${active ? styles.active : ""} ${className ?? ""}`.trim()}
      aria-hidden="true"
    />
  );
}
