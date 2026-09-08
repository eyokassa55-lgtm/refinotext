type AccordionItem = {
  question: string;
  answer: string;
};

type AccordionProps = {
  items: readonly AccordionItem[];
};

export function Accordion({ items }: AccordionProps) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)]">
      {items.map((item) => (
        <article key={item.question} className="px-6 py-5">
          <h3 className="text-base font-semibold text-foreground">{item.question}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">{item.answer}</p>
        </article>
      ))}
    </div>
  );
}
