import { useCallback, useRef, useState } from "react";
import { Scissors, Upload } from "lucide-react";
import { useVideoStore } from "@/store/useVideoStore";

const ACCEPTED_TYPES = "video/mp4,video/x-m4v,.mp4,.m4v";

export default function UploadArea() {
  const setFile = useVideoStore((s) => s.setFile);
  const setError = useVideoStore((s) => s.setError);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) {
        setError("请选择视频文件");
        return;
      }
      setFile(file);
    },
    [setFile, setError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="w-full max-w-2xl mx-auto animate-slide-up">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-3xl border-2 border-dashed
          p-12 sm:p-16 text-center transition-all duration-300
          ${
            isDragging
              ? "border-brand-cyan bg-brand-cyan/10 shadow-glow"
              : "border-white/20 bg-white/5 hover:border-brand-cyan/60 hover:bg-white/[0.07]"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-brand-cyan/20 blur-2xl rounded-full animate-pulse-slow" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-cyan/20 to-brand-purple/20 flex items-center justify-center border border-white/10">
              <Scissors className="w-9 h-9 text-brand-cyan" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">点按选择视频</h2>
            <p className="text-white/50 text-sm">或拖放到此处</p>
          </div>

          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">MP4</span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">M4V</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/40">
        <Upload className="w-4 h-4" />
        <span>本地处理 —— 视频不会离开您的设备</span>
      </div>
    </div>
  );
}
