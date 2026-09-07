import { splitHumanizeOutput } from "@/lib/humanize-output";

type HumanizedOutputViewProps = {
  text: string;
};

export function HumanizedOutputView({ text }: HumanizedOutputViewProps) {
  const { title, paragraphs } = splitHumanizeOutput(text);

  return (
    <article
      aria-label="Humanized output"
      className="min-h-[200px] flex-1 overflow-y-auto px-5 py-5 lg:min-h-0"
    >
      {title ? (
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
      ) : null}
      {title ? <div className="mt-3 mb-5 h-px w-16 rounded-full bg-accent" aria-hidden /> : null}
      <div className={title ? "space-y-4" : "space-y-4"}>
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.length}`} className="text-base leading-7 text-foreground">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
