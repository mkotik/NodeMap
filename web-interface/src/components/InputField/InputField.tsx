import { type InputHTMLAttributes } from "react";
import styles from "./InputField.module.scss";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function InputField({
  label,
  className,
  id,
  ...props
}: InputFieldProps) {
  return (
    <div className={`${styles.wrapper} ${className ?? ""}`.trim()}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <input id={id} className={styles.input} {...props} />
    </div>
  );
}
