import styles from "./NodeConnector.module.scss";

type BranchColor = "primary" | "secondary" | "tertiary";

interface NodeConnectorProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: BranchColor;
  active?: boolean;
  className?: string;
}

export default function NodeConnector({
  from,
  to,
  color = "primary",
  active = false,
  className,
}: NodeConnectorProps) {
  const midY = (from.y + to.y) / 2;

  const d = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;

  return (
    <svg
      className={`${styles.connector} ${className ?? ""}`.trim()}
      overflow="visible"
    >
      <path
        d={d}
        className={`${styles.path} ${styles[color]} ${active ? styles.active : ""}`.trim()}
      />
    </svg>
  );
}
