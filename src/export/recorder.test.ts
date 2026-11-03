import { afterEach, describe, expect, test, vi } from "vitest";
import {
  DriveRecorder,
  extensionForMime,
  pickRecorderMimeType
} from "./recorder";

type RecorderListener = (event: { data: Blob }) => void;

class FakeMediaRecorder {
  static isTypeSupported = (type: string): boolean =>
    type.startsWith("audio/webm") || type === "audio/mp4";

  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  private readonly listeners = new Map<string, Set<RecorderListener | (() => void)>>();
  private timesliceTimer: ReturnType<typeof setInterval> | null = null;
  private chunkIndex = 0;

  constructor(
    _stream: MediaStream,
    options?: { mimeType?: string }
  ) {
    this.mimeType = options?.mimeType ?? "audio/webm";
  }

  addEventListener(
    type: string,
    listener: RecorderListener | (() => void),
    _options?: { once?: boolean }
  ): void {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  start(timeslice?: number): void {
    this.state = "recording";
    if (typeof timeslice === "number" && timeslice > 0) {
      this.timesliceTimer = setInterval(() => {
        this.emitData(`slice-${this.chunkIndex++}`);
      }, timeslice);
    }
  }

  stop(): void {
    if (this.timesliceTimer) {
      clearInterval(this.timesliceTimer);
      this.timesliceTimer = null;
    }
    this.emitData(`final-${this.chunkIndex++}`);
    this.state = "inactive";
    const stopListeners = this.listeners.get("stop");
    stopListeners?.forEach((listener) => {
      (listener as () => void)();
    });
  }

  private emitData(label: string): void {
    const event = { data: new Blob([label], { type: this.mimeType }) };
    this.listeners.get("dataavailable")?.forEach((listener) => {
      (listener as RecorderListener)(event);
    });
  }
}

describe("pickRecorderMimeType", () => {
  test("prefers webm when supported", () => {
    expect(
      pickRecorderMimeType((type) => type === "audio/webm;codecs=opus")
    ).toBe("audio/webm;codecs=opus");
  });

  test("falls back to mp4 for Safari-like support matrices", () => {
    expect(
      pickRecorderMimeType((type) => type === "audio/mp4")
    ).toBe("audio/mp4");
  });

  test("returns undefined when nothing is supported so the browser can choose", () => {
    expect(pickRecorderMimeType(() => false)).toBeUndefined();
  });
});

describe("extensionForMime", () => {
  test("maps common recorder mime types", () => {
    expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/aac")).toBe("aac");
  });
});

describe("DriveRecorder chunk retention", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("keeps every timeslice, not only the final ~300ms chunk", async () => {
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.useFakeTimers();

    const downloads: Array<{ blob: Blob; filename: string }> = [];
    const stream = { id: "fake-stream" } as MediaStream;
    const recorder = new DriveRecorder(stream, {
      download: (blob, filename) => {
        downloads.push({ blob, filename });
      }
    });

    expect(recorder.start()).toBe(true);
    await vi.advanceTimersByTimeAsync(900);
    const saved = await recorder.saveThisDriveAndRestart();
    expect(saved).toBe(true);
    expect(downloads).toHaveLength(1);
    const first = downloads[0];
    expect(first).toBeDefined();
    const text = await first!.blob.text();
    expect(text).toContain("slice-0");
    expect(text).toContain("slice-1");
    expect(text).toContain("slice-2");
    expect(text).toContain("final-");
  });

  test("stopAndSave downloads the full take instead of discarding it", async () => {
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.useFakeTimers();

    const downloads: Array<{ blob: Blob; filename: string }> = [];
    const stream = { id: "fake-stream" } as MediaStream;
    const recorder = new DriveRecorder(stream, {
      download: (blob, filename) => {
        downloads.push({ blob, filename });
      }
    });

    expect(recorder.start()).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    const saved = await recorder.stopAndSave();
    expect(saved).toBe(true);
    expect(downloads).toHaveLength(1);
    const first = downloads[0];
    expect(first).toBeDefined();
    const text = await first!.blob.text();
    expect(text).toContain("slice-0");
    expect(text).toContain("slice-1");
  });
});
