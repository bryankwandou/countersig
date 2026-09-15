"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export function CopyCommand({ command }: { command: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-rule bg-sheet">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-4 py-3 font-mono text-[13px]">
        <span className="select-none text-graphite">$ </span>
        {command}
      </code>
      <button onClick={copy} className="min-w-20 border-l border-rule px-4 font-mono text-[12px] text-graphite hover:text-ink" aria-live="polite">
        {copied ? t.common.copied : t.common.copy}
      </button>
    </div>
  );
}
