import { useCallback, useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useVideoStore } from "@/store/useVideoStore";
import { formatTimeShort, parseTime } from "@/utils/format";

interface TimelineProps {
  currentTime: number;
  onSeek?: (time: number) => void;
}

const MIN_DURATION = 0.1; // 最小裁剪间隔（秒）

export default function Timeline({ currentTime, onSeek }: TimelineProps) {
  const duration = useVideoStore((s) => s.duration);
  const startTime = useVideoStore((s) => s.startTime);
  const endTime = useVideoStore((s) => s.endTime);
  const setRange = useVideoStore((s) => s.setRange);

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | "range" | null>(null);
  const dragStartX = useRef(0);
  const dragStartValues = useRef({ start: 0, end: 0 });

  // 时间输入框的本地字符串状态
  const [startInput, setStartInput] = useState(formatTimeShort(0));
  const [endInput, setEndInput] = useState(formatTimeShort(0));
  const [durationInput, setDurationInput] = useState(formatTimeShort(0));

  // 当 store 中的值变化时同步输入框（拖拽手柄时）
  useEffect(() => {
    setStartInput(formatTimeShort(startTime));
  }, [startTime]);
  useEffect(() => {
    setEndInput(formatTimeShort(endTime));
    setDurationInput(formatTimeShort(endTime - startTime));
  }, [endTime, startTime]);

  // 初始化结束时间为视频总时长
  useEffect(() => {
    if (duration > 0 && endTime === 0) {
      setRange(0, duration);
    }
  }, [duration, endTime, setRange]);

  const timeToPercent = useCallback(
    (time: number) => (duration > 0 ? (time / duration) * 100 : 0),
    [duration]
  );

  const percentToTime = useCallback(
    (percent: number) => (duration > 0 ? (percent / 100) * duration : 0),
    [duration]
  );

  const getPercentFromEvent = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handlePointerDown = (type: "start" | "end" | "range") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(type);
    dragStartX.current = e.clientX;
    dragStartValues.current = { start: startTime, end: endTime };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging || !trackRef.current) return;
      const percent = getPercentFromEvent(e.clientX);
      const time = percentToTime(percent);

      if (dragging === "start") {
        const newStart = Math.min(time, endTime - MIN_DURATION);
        setRange(Math.max(0, newStart), endTime);
      } else if (dragging === "end") {
        const newEnd = Math.max(time, startTime + MIN_DURATION);
        setRange(startTime, Math.min(duration, newEnd));
      } else if (dragging === "range") {
        const deltaX = e.clientX - dragStartX.current;
        const trackWidth = trackRef.current.getBoundingClientRect().width;
        const deltaTime = (deltaX / trackWidth) * duration;
        const rangeWidth = dragStartValues.current.end - dragStartValues.current.start;
        let newStart = dragStartValues.current.start + deltaTime;
        let newEnd = dragStartValues.current.end + deltaTime;
        if (newStart < 0) {
          newStart = 0;
          newEnd = rangeWidth;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - rangeWidth;
        }
        setRange(newStart, newEnd);
      }
    },
    [dragging, startTime, endTime, duration, getPercentFromEvent, percentToTime, setRange]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [dragging, handlePointerMove, handlePointerUp]);

  // 点击轨道跳转到指定位置
  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const percent = getPercentFromEvent(e.clientX);
    onSeek?.(percentToTime(percent));
  };

  // 提交开始时间输入
  const commitStart = () => {
    const parsed = parseTime(startInput);
    if (parsed === null) {
      setStartInput(formatTimeShort(startTime));
      return;
    }
    const clamped = Math.max(0, Math.min(parsed, endTime - MIN_DURATION));
    setRange(clamped, endTime);
  };

  // 提交结束时间输入
  const commitEnd = () => {
    const parsed = parseTime(endInput);
    if (parsed === null) {
      setEndInput(formatTimeShort(endTime));
      return;
    }
    const clamped = Math.max(startTime + MIN_DURATION, Math.min(parsed, duration));
    setRange(startTime, clamped);
  };

  // 提交时长输入：调整结束时间
  const commitDuration = () => {
    const parsed = parseTime(durationInput);
    if (parsed === null) {
      setDurationInput(formatTimeShort(endTime - startTime));
      return;
    }
    const newEnd = Math.max(startTime + MIN_DURATION, Math.min(startTime + parsed, duration));
    setRange(startTime, newEnd);
  };

  // 设置起点为当前播放位置
  const setStartToCurrent = () => {
    const clamped = Math.max(0, Math.min(currentTime, endTime - MIN_DURATION));
    setRange(clamped, endTime);
  };

  // 设置终点为当前播放位置
  const setEndToCurrent = () => {
    const clamped = Math.max(startTime + MIN_DURATION, Math.min(currentTime, duration));
    setRange(startTime, clamped);
  };

  // 输入框回车提交
  const handleKeyDown = (commit: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  const startPercent = timeToPercent(startTime);
  const endPercent = timeToPercent(endTime);
  const currentPercent = timeToPercent(currentTime);

  // 生成时间刻度
  const tickCount = 10;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (duration / tickCount) * i);

  return (
    <div className="w-full select-none">
      {/* 时间刻度 */}
      <div className="flex justify-between text-[10px] text-white/40 mb-2 px-1 font-mono">
        {ticks.map((t, i) => (
          <span key={i}>{formatTimeShort(t)}</span>
        ))}
      </div>

      {/* 轨道 */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-14 rounded-xl bg-white/5 cursor-pointer overflow-hidden"
      >
        {/* 背景进度纹理 */}
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-1.5 mx-3 bg-white/10 rounded-full" />
        </div>

        {/* 选中区域 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-brand-cyan to-brand-cyan-soft rounded-full shadow-glow"
          style={{ left: `calc(${startPercent}% )`, width: `calc(${endPercent - startPercent}%)` }}
          onPointerDown={handlePointerDown("range")}
        />

        {/* 当前播放位置指示器 */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/70 pointer-events-none"
          style={{ left: `${currentPercent}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-lg" />
        </div>

        {/* 起点手柄 */}
        <div
          className="absolute top-0 bottom-0 z-10 cursor-ew-resize group"
          style={{ left: `calc(${startPercent}% - 12px)` }}
          onPointerDown={handlePointerDown("start")}
        >
          <div className="w-6 h-full flex items-center justify-center">
            <div className="w-1.5 h-10 rounded-full bg-brand-cyan shadow-glow group-hover:scale-110 transition-transform" />
          </div>
        </div>

        {/* 终点手柄 */}
        <div
          className="absolute top-0 bottom-0 z-10 cursor-ew-resize group"
          style={{ left: `calc(${endPercent}% - 12px)` }}
          onPointerDown={handlePointerDown("end")}
        >
          <div className="w-6 h-full flex items-center justify-center">
            <div className="w-1.5 h-10 rounded-full bg-brand-cyan shadow-glow group-hover:scale-110 transition-transform" />
          </div>
        </div>
      </div>

      {/* 时间信息 */}
      <div className="flex justify-between items-end mt-3 text-xs gap-3">
        <div className="flex flex-col items-start gap-1">
          <span className="text-white/40">开始</span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              onBlur={commitStart}
              onKeyDown={handleKeyDown(commitStart)}
              className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-brand-cyan font-mono font-medium text-center focus:outline-none focus:border-brand-cyan/50"
            />
            <button
              onClick={setStartToCurrent}
              title="设置起点到当前播放位置"
              className="p-1 rounded text-white/50 hover:text-brand-cyan hover:bg-white/5 transition-colors"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-white/40">时长</span>
          <input
            type="text"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            onBlur={commitDuration}
            onKeyDown={handleKeyDown(commitDuration)}
            className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-white font-mono font-medium text-center focus:outline-none focus:border-brand-cyan/50"
          />
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-white/40">结束</span>
          <div className="flex items-center gap-1">
            <button
              onClick={setEndToCurrent}
              title="设置终点到当前播放位置"
              className="p-1 rounded text-white/50 hover:text-brand-cyan hover:bg-white/5 transition-colors"
            >
              <Flag className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              onBlur={commitEnd}
              onKeyDown={handleKeyDown(commitEnd)}
              className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-brand-cyan font-mono font-medium text-center focus:outline-none focus:border-brand-cyan/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
