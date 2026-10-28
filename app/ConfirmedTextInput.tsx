"use client";

import { type InputHTMLAttributes, useRef, useState } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "onKeyDown"
> & {
  value: string;
  onCommit: (value: string) => void;
};

export function ConfirmedTextInput({ value, onCommit, ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const composingRef = useRef(false);

  return (
    <input
      {...props}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={() => { composingRef.current = false; }}
      onBlur={(event) => {
        const next = event.currentTarget.value;
        if (draft !== null && next !== value) onCommit(next);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          !composingRef.current &&
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229
        ) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
