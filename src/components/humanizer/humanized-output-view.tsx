import { normalizeContinuousProse } from "@/lib/editor-html";
import { splitHumanizeOutput } from "@/lib/humanize-output";

type HumanizedOutputViewProps = {
  text: string;
};

export function HumanizedOutputView({ text }: HumanizedOutputViewProps) {
  const { title, paragraphs } = splitHumanizeOutput(text);

  return (
    <article aria-label="Humanized output" className="mx-auto w-full max-w-[44rem] bg-white font-sans">
      {title ? (
        <h1 className="mb-1.5 text-[18px] font-bold leading-[1.35] tracking-[-0.02em] text-[#111111]">
          {title}
        </h1>
      ) : null}
      {paragraphs.length > 0 ? (
        <p className="text-[15px] font-normal leading-[1.7] text-[#202122]">
          {normalizeContinuousProse(paragraphs.join(" "))}
        </p>
      ) : null}
    </article>
  );
}
