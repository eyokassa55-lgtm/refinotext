import { humanizePlainTextToHtml } from "@/lib/editor-html";

type HumanizedOutputViewProps = {
  text: string;
};

export function HumanizedOutputView({ text }: HumanizedOutputViewProps) {
  return (
    <article
      aria-label="Humanized output"
      className="humanizer-prose humanizer-prose-output mx-auto w-full max-w-[44rem] bg-white"
      dangerouslySetInnerHTML={{ __html: humanizePlainTextToHtml(text) }}
    />
  );
}
