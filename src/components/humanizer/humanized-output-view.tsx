import { splitHumanizeOutput } from "@/lib/humanize-output";

type HumanizedOutputViewProps = {
  text: string;
};

export function HumanizedOutputView({ text }: HumanizedOutputViewProps) {
  const { title, paragraphs } = splitHumanizeOutput(text);

  return (
    <article aria-label="Humanized output" className="mx-auto w-full max-w-[44rem] bg-white font-sans">
      {title ? (
        <h1 className="mb-3 text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-[#111111] sm:text-[20px]">
          {title}
        </h1>
      ) : null}
      <div className="space-y-[0.85em]">
        {paragraphs.map((paragraph, index) => (
          <p
            key={`${index}-${paragraph.slice(0, 24)}`}
            className="text-[13px] font-normal leading-[1.6] text-[#202122] sm:text-[14px]"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
