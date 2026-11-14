import { forwardRef, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useVideoStore } from "@/store/useVideoStore";
import { formatTimeShort } from "@/utils/format";

interface VideoPreviewProps {
  onTimeUpdate?: (currentTime: number) => void;
}

const VideoPreview = forwardRef<HTMLVideoElement, VideoPreviewProps>(
  ({ onTimeUpdate }, ref) => {
    const videoUrl = useVideoStore((s) => s.videoUrl);
    const setDuration = useVideoStore((s) => s.setDuration);
    const startTime = useVideoStore((s) => s.startTime);
    const endTime = useVideoStore((s) => s.endTime);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setLocalDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const videoRef = useRef<HTMLVideoElement>(null);

    // 合并 ref
    useEffect(() => {
      if (typeof ref === "function") {
        ref(videoRef.current);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLVideoElement | null>).current = videoRef.current;
      }
    }, [ref]);

    const togglePlay = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    };

    const toggleMute = () => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setIsMuted(video.muted);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setVolume(v);
      if (videoRef.current) {
        videoRef.current.volume = v;
        videoRef.current.muted = v === 0;
        setIsMuted(v === 0);
      }
    };

    // 限制播放范围在裁剪区间内
    const handleTimeUpdate = () => {
      const video = videoRef.current;
      if (!video) return;
      const t = video.currentTime;
      setCurrentTime(t);
      onTimeUpdate?.(t);

      // 播放到结束点时停止
      if (endTime > 0 && t >= endTime) {
        video.pause();
        video.currentTime = startTime;
      }
    };

    // 键盘快捷键
    useEffect(() => {
      if (!videoUrl) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        // 在输入框中不响应快捷键
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        const seekStep = video.paused ? 1 : 10;

        switch (e.code) {
          case "Space":
            e.preventDefault();
            togglePlay();
            break;
          case "ArrowLeft":
            e.preventDefault();
            {
              const newTime = Math.max(startTime, video.currentTime - seekStep);
              video.currentTime = newTime;
            }
            break;
          case "ArrowRight":
            e.preventDefault();
            {
              const maxTime = endTime > 0 ? endTime : video.duration;
              const newTime = Math.min(maxTime, video.currentTime + seekStep);
              video.currentTime = newTime;
            }
            break;
          case "ArrowUp":
            e.preventDefault();
            {
              const newVolume = Math.min(1, video.volume + 0.1);
              video.volume = newVolume;
              video.muted = false;
              setVolume(newVolume);
              setIsMuted(false);
            }
            break;
          case "ArrowDown":
            e.preventDefault();
            {
              const newVolume = Math.max(0, video.volume - 0.1);
              video.volume = newVolume;
              video.muted = newVolume === 0;
              setVolume(newVolume);
              setIsMuted(newVolume === 0);
            }
            break;
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [videoUrl, startTime, endTime]);

    return (
      <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-video group">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain bg-black"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            setLocalDuration(d);
            setDuration(d);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onClick={togglePlay}
          playsInline
        />

        {/* 控制栏 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-brand-cyan flex items-center justify-center text-black hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="flex items-center gap-2 flex-1">
              <span className="text-white/80 text-sm font-mono w-24">
                {formatTimeShort(currentTime)} / {formatTimeShort(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white/80 hover:text-white">
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 accent-brand-cyan"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPreview.displayName = "VideoPreview";

export default VideoPreview;
