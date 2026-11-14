/**
 * 将秒数格式化为 mm:ss.ms 或 hh:mm:ss.ms
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/**
 * 简洁格式 mm:ss
 */
export function formatTimeShort(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 解析时间字符串为秒数
 * 支持格式：纯秒数 "90"、"mm:ss" "1:30"、"hh:mm:ss" "1:01:30"
 * 解析失败返回 null
 */
export function parseTime(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((p) => p.trim());
    if (parts.some((p) => p === "" || isNaN(Number(p)))) return null;
    const nums = parts.map(Number);
    if (nums.length === 2) {
      const [m, s] = nums;
      if (m < 0 || s < 0 || s >= 60) return null;
      return m * 60 + s;
    }
    if (nums.length === 3) {
      const [h, m, s] = nums;
      if (h < 0 || m < 0 || s < 0 || m >= 60 || s >= 60) return null;
      return h * 3600 + m * 60 + s;
    }
    return null;
  }

  const num = Number(trimmed);
  if (isNaN(num) || num < 0) return null;
  return num;
}
