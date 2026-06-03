import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  "data-testid"?: string;
}

export default function BackButton({ onClick, label = "Назад", "data-testid": testId }: BackButtonProps) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 bg-secondary/50 hover:bg-secondary border border-border/60 rounded-full px-3 py-1.5 mb-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-all active:scale-95"
    >
      <ArrowLeft className="w-3 h-3" />
      {label}
    </button>
  );
}
