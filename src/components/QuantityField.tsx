import { useState } from "react";

interface QuantityFieldProps {
  id?: string;
  label: string;
  quantity: number;
  onCommit: (quantity: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function QuantityField({
  id,
  label,
  quantity,
  onCommit,
  disabled,
  className,
}: QuantityFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      id={id}
      aria-label={label}
      type="text"
      inputMode="numeric"
      enterKeyHint="done"
      pattern="[0-9]*"
      value={draft ?? quantity}
      disabled={disabled}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const value = event.currentTarget.value;
        if (/^\d*$/.test(value)) setDraft(value);
      }}
      onBlur={(event) => {
        const value = event.currentTarget.value;
        setDraft(null);
        if (!value || disabled) return;

        const next = Number(value);
        if (next !== quantity) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape" && draft !== null) {
          event.stopPropagation();
          setDraft(null);
        }
      }}
      className={`min-w-0 rounded-small border border-transparent bg-transparent text-center text-sm font-semibold tabular-nums outline-none hover:border-divider focus:border-focus disabled:opacity-60 ${className ?? ""}`}
    />
  );
}
