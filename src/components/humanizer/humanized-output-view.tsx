import { humanizerEditorTextClassName } from "./humanizer-editor-styles";

type HumanizedOutputViewProps = {
  text: string;
};

export function HumanizedOutputView({ text }: HumanizedOutputViewProps) {
  return (
    <textarea
      readOnly
      aria-label="Humanized output"
      value={text}
      className={`h-full min-h-0 w-full resize-none whitespace-pre-wrap ${humanizerEditorTextClassName}`}
    />
  );
}
