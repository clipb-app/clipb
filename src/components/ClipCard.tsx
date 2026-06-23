import { Check, Clipboard, Pin, PinOff, Trash2 } from "lucide-react";
import type { Clip } from "../types";
import { formatTime } from "../lib/dates";

interface ClipCardProps {
  clip: Clip;
  copied: boolean;
  onCopy: (clip: Clip) => void;
  onDelete: (id: number) => void;
  onTogglePin: (clip: Clip) => void;
}

export function ClipCard({
  clip,
  copied,
  onCopy,
  onDelete,
  onTogglePin,
}: ClipCardProps) {
  const preview =
    clip.content.length > 700
      ? `${clip.content.slice(0, 700)}...`
      : clip.content;

  return (
    <article className="clip-card">
      <div className="clip-card__meta">
        <span>{formatTime(clip.created_at)}</span>

        {clip.is_pinned ? <span className="pill">Pinned</span> : null}
      </div>

      <pre className="clip-card__content">{preview}</pre>

      <div className="clip-card__actions">
        <button className="icon-button" onClick={() => onCopy(clip)}>
          {copied ? <Check size={16} /> : <Clipboard size={16} />}
          {copied ? "Copied" : "Copy"}
        </button>

        <button className="icon-button" onClick={() => onTogglePin(clip)}>
          {clip.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
          {clip.is_pinned ? "Unpin" : "Pin"}
        </button>

        <button
          className="icon-button danger"
          onClick={() => onDelete(clip.id)}
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </article>
  );
}
