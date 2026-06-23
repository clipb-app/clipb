import { Clipboard } from "lucide-react";

export function EmptyState() {
  return (
    <div className="empty-state">
      <Clipboard size={42} />
      <h2>No clips found</h2>
      <p>
        Copy some text anywhere on your computer and ClipB will save it here.
      </p>
    </div>
  );
}
