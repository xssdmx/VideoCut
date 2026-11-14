import { Scissors, Shield } from "lucide-react";

export default function Header() {
  return (
    <header className="w-full border-b border-white/5 backdrop-blur-sm bg-ink-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-purple flex items-center justify-center">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">视频裁剪工具</h1>
            <p className="text-[11px] text-white/40 leading-tight">本地处理 · 无损画质 · 无需上传</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">视频不会离开设备</span>
        </div>
      </div>
    </header>
  );
}
