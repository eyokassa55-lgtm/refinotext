type AccordionItem = {
  question: string;
  answer: string;
};

type AccordionProps = {
  items: readonly AccordionItem[];
};

export function Accordion({ items }: AccordionProps) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card">
      {items.map((item) => (
        <article key={item.question} className="px-6 py-5">
          <h3 className="text-base font-semibold text-foreground">{item.question}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">{item.answer}</p>
        </article>
      ))}
    </div>
  );
}
