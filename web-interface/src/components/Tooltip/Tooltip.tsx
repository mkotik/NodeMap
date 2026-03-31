"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import "./Tooltip.scss";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  text: string;
  position?: TooltipPosition;
  children: ReactNode;
}

export default function Tooltip({
  text,
  position = "top",
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  function show() {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), 400);
  }

  function hide() {
    clearTimeout(timeoutRef.current);
    setVisible(false);
    setCoords(null);
  }

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    const gap = 6;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = trigger.top - tip.height - gap;
        left = trigger.left + trigger.width / 2 - tip.width / 2;
        break;
      case "bottom":
        top = trigger.bottom + gap;
        left = trigger.left + trigger.width / 2 - tip.width / 2;
        break;
      case "left":
        top = trigger.top + trigger.height / 2 - tip.height / 2;
        left = trigger.left - tip.width - gap;
        break;
      case "right":
        top = trigger.top + trigger.height / 2 - tip.height / 2;
        left = trigger.right + gap;
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tip.height - 8));

    setCoords({ top, left });
  }, [visible, position]);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div
      className="tooltip-trigger"
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip--${position}${coords ? " tooltip--visible" : ""}`}
          role="tooltip"
          style={
            coords
              ? { top: coords.top, left: coords.left, position: "fixed" }
              : { position: "fixed", opacity: 0, pointerEvents: "none" }
          }
        >
          {text}
        </div>
      )}
    </div>
  );
}
