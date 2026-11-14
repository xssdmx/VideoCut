import { create } from "zustand";

interface VideoState {
  file: File | null;
  videoUrl: string;
  duration: number;
  startTime: number;
  endTime: number;
  isProcessing: boolean;
  progress: number;
  error: string | null;

  setFile: (file: File) => void;
  setDuration: (duration: number) => void;
  setRange: (start: number, end: number) => void;
  setProcessing: (processing: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  file: null,
  videoUrl: "",
  duration: 0,
  startTime: 0,
  endTime: 0,
  isProcessing: false,
  progress: 0,
  error: null,

  setFile: (file) => {
    const url = URL.createObjectURL(file);
    set({ file, videoUrl: url, startTime: 0, endTime: 0, duration: 0, error: null });
  },

  setDuration: (duration) =>
    set((state) => ({
      duration,
      endTime: state.endTime === 0 ? duration : state.endTime,
    })),

  setRange: (start, end) => set({ startTime: start, endTime: end }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  setProgress: (progress) => set({ progress }),

  setError: (error) => set({ error }),

  reset: () => {
    set((state) => {
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      return {
        file: null,
        videoUrl: "",
        duration: 0,
        startTime: 0,
        endTime: 0,
        isProcessing: false,
        progress: 0,
        error: null,
      };
    });
  },
}));
