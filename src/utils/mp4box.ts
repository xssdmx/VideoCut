import { createFile, DataStream } from "mp4box";
import type { Track, MP4BoxBuffer } from "mp4box";

interface TrackInfo {
  trak: any;
  startSample: number;
  endSample: number;
  samples: any[];
  timescale: number;
}

/**
 * 无损裁剪 MP4 文件
 * 在关键帧处切割，不重新编码，保持原画质
 */
export async function trimMP4Lossless(
  file: File,
  startTime: number,
  endTime: number
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const mp4boxFile = createFile();

  return new Promise<Blob>((resolve, reject) => {
    mp4boxFile.onReady = (info) => {
      try {
        const tracks: Track[] = [...info.videoTracks, ...info.audioTracks];
        if (tracks.length === 0) {
          reject(new Error("未找到视频或音频轨道"));
          return;
        }

        const moov = mp4boxFile.moov;
        const traks = moov.traks;
        const originalBytes = new Uint8Array(arrayBuffer);
        const ftypSize = mp4boxFile.ftyp.size;

        // 收集每个轨道需要保留的样本范围
        const trackInfos: TrackInfo[] = [];

        // 先确定视频轨道的关键帧对齐起点，所有轨道以此为基准保持音视频同步
        const videoTrack = tracks.find((t) => t.type === "video");
        let alignedStartTime = startTime;
        if (videoTrack) {
          const videoSamples = mp4boxFile.getTrackSamplesInfo(videoTrack.id);
          if (videoSamples && videoSamples.length > 0) {
            let minDist = Infinity;
            let videoStartSample = 0;
            for (const s of videoSamples) {
              if (!s.is_sync) continue;
              const t = s.dts / videoTrack.timescale;
              const dist = Math.abs(t - startTime);
              if (dist <= minDist) {
                minDist = dist;
                videoStartSample = s.number;
              }
            }
            alignedStartTime = videoSamples[videoStartSample].dts / videoTrack.timescale;
          }
        }

        for (const trak of traks) {
          const track = tracks.find((t) => t.id === trak.tkhd.track_id);
          if (!track) continue;

          const samples = mp4boxFile.getTrackSamplesInfo(track.id);
          if (!samples || samples.length === 0) continue;

          const isVideo = track.type === "video";

          // 起点：视频轨道必须是关键帧，其他轨道对齐到视频起点时间
          let startSample = 0;
          let startMinDist = Infinity;
          for (const s of samples) {
            if (isVideo && !s.is_sync) continue;
            const t = s.dts / track.timescale;
            const dist = Math.abs(t - alignedStartTime);
            if (dist <= startMinDist) {
              startMinDist = dist;
              startSample = s.number;
            }
          }

          // 终点：对齐到 endTime（所有轨道独立取最近样本，误差在一帧以内）
          let endSample = samples[samples.length - 1].number;
          let endMinDist = Infinity;
          for (const s of samples) {
            const t = s.dts / track.timescale;
            const dist = Math.abs(t - endTime);
            if (dist < endMinDist) {
              endMinDist = dist;
              endSample = s.number;
            }
          }

          // 安全校验：确保 start <= end
          if (startSample > endSample) {
            startSample = endSample;
          }

          trackInfos.push({ trak, startSample, endSample, samples, timescale: track.timescale });
        }

        // 为每个轨道提取连续的样本数据（去交错）
        const trackDataBlocks: Uint8Array[] = [];
        const trackMdatOffsets: number[] = [];
        let mdatPos = 0;

        for (const info of trackInfos) {
          const { samples, startSample, endSample } = info;
          const chunks: Uint8Array[] = [];
          for (let i = startSample; i <= endSample; i++) {
            const s = samples[i];
            chunks.push(originalBytes.slice(s.offset, s.offset + s.size));
          }
          const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
          const merged = new Uint8Array(totalLen);
          let pos = 0;
          for (const c of chunks) {
            merged.set(c, pos);
            pos += c.length;
          }
          trackMdatOffsets.push(mdatPos);
          trackDataBlocks.push(merged);
          mdatPos += totalLen;
        }

        // 新 mdat = [track0 data][track1 data]...
        const mdatData = new Uint8Array(mdatPos);
        let mdatWritePos = 0;
        for (const block of trackDataBlocks) {
          mdatData.set(block, mdatWritePos);
          mdatWritePos += block.length;
        }

        // 修改每个轨道的 sample table
        for (const info of trackInfos) {
          modifyTrackSampleTable(info, ftypSize);
        }

        // 修改 movie duration
        const maxDuration = Math.max(
          ...trackInfos.map((info) => {
            const { samples, startSample, endSample, timescale } = info;
            const startDts = samples[startSample]?.dts ?? 0;
            const endDts = samples[endSample]?.dts ?? 0;
            const lastDuration = samples[endSample]?.duration ?? 0;
            return (endDts - startDts + lastDuration) / timescale;
          })
        );

        if (moov.mvhd) {
          moov.mvhd.duration = Math.ceil(maxDuration * moov.mvhd.timescale);
        }

        // 第一次序列化 moov，得到 moov 大小
        const moovStream1 = new DataStream();
        moov.write(moovStream1);
        const moovData1 = new Uint8Array(
          moovStream1.buffer.slice(0, moovStream1.byteLength)
        );
        const newMdatStart = ftypSize + moovData1.length;

        // 修正 stco，指向新 mdat 中各轨道数据的起始位置
        for (let idx = 0; idx < trackInfos.length; idx++) {
          const stco = trackInfos[idx].trak.mdia.minf.stbl.stco;
          stco.chunk_offsets = [newMdatStart + 8 + trackMdatOffsets[idx]];
        }

        // 第二次序列化 moov（含修正后的 stco）
        const moovStream2 = new DataStream();
        moov.write(moovStream2);
        const moovData2 = new Uint8Array(
          moovStream2.buffer.slice(0, moovStream2.byteLength)
        );

        // 构建最终文件: ftyp + moov + mdat
        const mdatBoxSize = 8 + mdatData.length;
        const totalSize = ftypSize + moovData2.length + mdatBoxSize;
        const result = new Uint8Array(totalSize);

        let offset = 0;
        result.set(originalBytes.slice(0, ftypSize), offset);
        offset += ftypSize;

        result.set(moovData2, offset);
        offset += moovData2.length;

        // 写 mdat box header
        const view = new DataView(result.buffer, result.byteOffset + offset, 8);
        view.setUint32(0, mdatBoxSize);
        view.setUint32(4, 0x6d646174); // "mdat"
        offset += 8;

        result.set(mdatData, offset);

        resolve(new Blob([result], { type: "video/mp4" }));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };

    mp4boxFile.onError = (_module: string, message: string) => {
      reject(new Error(message));
    };

    const buffer = arrayBuffer as MP4BoxBuffer;
    buffer.fileStart = 0;
    mp4boxFile.appendBuffer(buffer, true);
    mp4boxFile.flush();
  });
}

/**
 * 修改轨道的 sample table（stsz, stts, stsc, stco, stss, ctts, tkhd, mdhd）
 */
function modifyTrackSampleTable(info: TrackInfo, placeholderOffset: number) {
  const { trak, startSample, endSample, samples } = info;
  const stbl = trak.mdia.minf.stbl;

  // 1. stsz (sample sizes)
  const newSampleSizes: number[] = [];
  for (let i = startSample; i <= endSample; i++) {
    newSampleSizes.push(samples[i].size);
  }
  stbl.stsz.sample_size = 0;
  stbl.stsz.sample_sizes = newSampleSizes;
  stbl.stsz.sample_count = newSampleSizes.length;

  // 2. stts (time to sample)
  const counts: number[] = [];
  const deltas: number[] = [];
  let prevDelta = samples[startSample].duration;
  let count = 1;
  for (let i = startSample + 1; i <= endSample; i++) {
    const delta = samples[i].duration;
    if (delta === prevDelta) {
      count++;
    } else {
      counts.push(count);
      deltas.push(prevDelta);
      prevDelta = delta;
      count = 1;
    }
  }
  counts.push(count);
  deltas.push(prevDelta);
  stbl.stts.sample_counts = counts;
  stbl.stts.sample_deltas = deltas;

  // 3. stsc (sample to chunk) - 所有样本放在一个 chunk
  stbl.stsc.first_chunk = [1];
  stbl.stsc.samples_per_chunk = [newSampleSizes.length];
  stbl.stsc.sample_description_index = [1];

  // 4. stco (chunk offset) - 占位，后面修正
  stbl.stco.chunk_offsets = [placeholderOffset];

  // 5. stss (sync samples) - 转换为新的相对编号（1-based）
  if (stbl.stss) {
    const newSyncSamples: number[] = [];
    for (const num of stbl.stss.sample_numbers) {
      const idx = num - 1; // stss 是 1-based
      if (idx >= startSample && idx <= endSample) {
        newSyncSamples.push(idx - startSample + 1);
      }
    }
    stbl.stss.sample_numbers = newSyncSamples.length > 0 ? newSyncSamples : [1];
  }

  // 6. tkhd 和 mdhd 的 duration
  const startDts = samples[startSample].dts;
  const endDts = samples[endSample].dts;
  const lastDuration = samples[endSample].duration;
  const newDuration = endDts - startDts + lastDuration;

  if (trak.tkhd) {
    trak.tkhd.duration = newDuration;
  }
  if (trak.mdia.mdhd) {
    trak.mdia.mdhd.duration = newDuration;
  }

  // 7. ctts (composition offset) 如果存在
  if (stbl.ctts) {
    const sampleOffsets = stbl.ctts.sample_offsets || [];
    const sampleCounts = stbl.ctts.sample_counts || [];

    let globalIdx = 0;
    const newCttsEntries: Array<{ count: number; offset: number }> = [];
    for (let e = 0; e < sampleCounts.length; e++) {
      const entryCount = sampleCounts[e];
      const entryOffset = sampleOffsets[e];
      for (let c = 0; c < entryCount; c++) {
        if (globalIdx >= startSample && globalIdx <= endSample) {
          if (
            newCttsEntries.length > 0 &&
            newCttsEntries[newCttsEntries.length - 1].offset === entryOffset
          ) {
            newCttsEntries[newCttsEntries.length - 1].count++;
          } else {
            newCttsEntries.push({ count: 1, offset: entryOffset });
          }
        }
        globalIdx++;
      }
    }
    stbl.ctts.sample_counts = newCttsEntries.map((e) => e.count);
    stbl.ctts.sample_offsets = newCttsEntries.map((e) => e.offset);
  }
}

/**
 * 检查文件是否为 MP4 格式
 */
export function isMP4File(file: File): boolean {
  return (
    file.type === "video/mp4" ||
    file.name.toLowerCase().endsWith(".mp4") ||
    file.name.toLowerCase().endsWith(".m4v")
  );
}
