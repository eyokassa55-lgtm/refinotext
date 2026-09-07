type HumanizedOutputViewProps = {
  text: string;
};

export function HumanizedOutputView({ text }: HumanizedOutputViewProps) {
  return (
    <textarea
      readOnly
      aria-label="Humanized output"
      value={text}
      className="min-h-[200px] flex-1 resize-none bg-transparent px-5 py-4 text-base leading-relaxed text-foreground focus-visible:outline-none lg:min-h-0"
    />
  );
}
