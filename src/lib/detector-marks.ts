export type DetectorMark = {
  src: string;
  name: string;
  iconClassName?: string;
};

export const DETECTOR_MARKS_ROW_ONE: DetectorMark[] = [
  { src: "/marks/turnitin.png", name: "Turnitin" },
  { src: "/marks/originality.png", name: "Originality.ai" },
  { src: "/marks/gptzero.png", name: "GPTZero" },
  { src: "/marks/copyleaks.png", name: "Copyleaks" },
  { src: "/marks/pangram.png", name: "Pangram" },
  { src: "/marks/quillbot.png", name: "QuillBot" },
  {
    src: "/marks/winston.png",
    name: "Winston AI",
    iconClassName: "rounded-full",
  },
  { src: "/marks/zerogpt.png", name: "ZeroGPT" },
  { src: "/marks/writer.png", name: "Writer" },
];

export const DETECTOR_MARKS_ROW_TWO: DetectorMark[] = [
  { src: "/marks/smodin.png", name: "Smodin" },
  { src: "/marks/sapling.png", name: "Sapling" },
  {
    src: "/marks/undetectable.png",
    name: "Undetectable.ai",
    iconClassName: "rounded-md",
  },
  { src: "/marks/scribbr.png", name: "Scribbr" },
  { src: "/marks/grammarly.png", name: "Grammarly AI" },
];

export const DETECTOR_MARKS = [
  ...DETECTOR_MARKS_ROW_ONE,
  ...DETECTOR_MARKS_ROW_TWO,
] as const;
