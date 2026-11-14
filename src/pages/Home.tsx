import { useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useVideoStore } from "@/store/useVideoStore";
import Header from "@/components/Header";
import UploadArea from "@/components/UploadArea";
import VideoPreview from "@/components/VideoPreview";
import Timeline from "@/components/Timeline";
import ExportButton from "@/components/ExportButton";

export default function Home() {
  const file = useVideoStore((s) => s.file);
  const error = useVideoStore((s) => s.error);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-900 via-ink-800 to-ink-900 text-white">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-purple/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-cyan/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Header />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {!file ? (
            <div className="flex flex-col items-center gap-8 animate-fade-in">
              <div className="text-center max-w-2xl space-y-4">
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                  快速裁剪你的视频
                </h2>
                <p className="text-white/50 text-lg leading-relaxed">
                  免费剪切 MP4 视频，全程在浏览器本地完成，
                  无需上传、无水印、无需注册。无损剪切保留 100% 原始画质，几秒完成。
                </p>
              </div>
              <UploadArea />
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* 错误提示 */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左侧：视频预览 + 时间轴 */}
                <div className="lg:col-span-2 space-y-6">
                  <VideoPreview
                    ref={videoRef}
                    onTimeUpdate={setCurrentTime}
                  />
                  <Timeline currentTime={currentTime} onSeek={handleSeek} />
                </div>

                {/* 右侧：控制面板 */}
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h3 className="text-sm font-medium text-white/80">文件信息</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/40">文件名</span>
                        <span className="text-white/80 truncate max-w-[60%]">{file.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">大小</span>
                        <span className="text-white/80">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
                    </div>
                  </div>

                  <ExportButton />
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="border-t border-white/5 py-6 mt-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-white/30">
            本地视频裁剪工具 · 所有处理均在您的浏览器中完成，视频不会上传到任何服务器
          </div>
        </footer>
      </div>
    </div>
  );
}
