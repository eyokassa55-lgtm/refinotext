export function HumanizerOutputMotion() {
  return (
    <div
      className="humanizer-write-motion pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
      <div className="humanizer-write-aurora" />
      <div className="humanizer-write-beam" />
      <div className="relative px-6 py-6 sm:px-8 sm:py-7">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#0F634A]/15 bg-[#0F634A]/5 px-2.5 py-1 text-[11px] font-semibold text-[#0F634A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0F634A]" />
          Writing
        </div>
        <span className="humanizer-write-caret" />
        <div className="mt-5 space-y-3">
          <div className="humanizer-write-line" style={{ width: "92%", animationDelay: "0s" }} />
          <div className="humanizer-write-line" style={{ width: "76%", animationDelay: "0.22s" }} />
          <div className="humanizer-write-line" style={{ width: "88%", animationDelay: "0.44s" }} />
          <div className="humanizer-write-line" style={{ width: "61%", animationDelay: "0.66s" }} />
        </div>
      </div>
    </div>
  );
}
