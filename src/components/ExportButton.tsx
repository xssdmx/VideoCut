import { useCallback, useRef } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { useVideoStore } from "@/store/useVideoStore";
import { trimMP4Lossless, isMP4File } from "@/utils/mp4box";

export default function ExportButton() {
  const file = useVideoStore((s) => s.file);
  const startTime = useVideoStore((s) => s.startTime);
  const endTime = useVideoStore((s) => s.endTime);
  const isProcessing = useVideoStore((s) => s.isProcessing);
  const progress = useVideoStore((s) => s.progress);
  const setProcessing = useVideoStore((s) => s.setProcessing);
  const setProgress = useVideoStore((s) => s.setProgress);
  const setError = useVideoStore((s) => s.setError);
  const reset = useVideoStore((s) => s.reset);
  const processingRef = useRef(false);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExport = useCallback(async () => {
    if (!file || processingRef.current) return;
    if (endTime - startTime < 0.1) {
      setError("裁剪时长过短，请至少选择 0.1 秒");
      return;
    }
    if (!isMP4File(file)) {
      setError("无损裁剪仅支持 MP4 格式，请选择 MP4 文件");
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    setError(null);
    setProgress(0);

    try {
      setProgress(30);
      const blob = await trimMP4Lossless(file, startTime, endTime);
      setProgress(90);

      const ext = "mp4";
      let baseName = file.name.replace(/\.[^.]+$/, "");
      // 避免重复添加 _trimmed 后缀
      if (!baseName.endsWith("_trimmed")) {
        baseName = `${baseName}_trimmed`;
      }
      const filename = `${baseName}.${ext}`;

      setProgress(100);
      triggerDownload(blob, filename);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`导出失败：${message}`);
    } finally {
      processingRef.current = false;
      setProcessing(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [file, startTime, endTime, setProcessing, setProgress, setError]);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleExport}
        disabled={isProcessing}
        className={`
          flex items-center justify-center gap-2 py-4 px-8 rounded-2xl font-semibold text-lg
          transition-all duration-300
          ${
            isProcessing
              ? "bg-brand-cyan/50 text-black/60 cursor-not-allowed"
              : "bg-gradient-to-r from-brand-cyan to-brand-cyan-soft text-black hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]"
          }
        `}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            处理中... {Math.round(progress)}%
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            导出视频
          </>
        )}
      </button>

      {/* 进度条 */}
      {isProcessing && (
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-cyan transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <button
        onClick={reset}
        disabled={isProcessing}
        className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all border border-white/10 disabled:opacity-50"
      >
        <RotateCcw className="w-4 h-4" />
        重新选择视频
      </button>
    </div>
  );
}
