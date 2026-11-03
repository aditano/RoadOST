const TIMESLICE_MS = 300;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg"
] as const;

export type RecorderDownload = (blob: Blob, filename: string) => void;

export type DriveRecorderOptions = {
  download?: RecorderDownload;
};

const formatStamp = (): string => {
  const now = new Date();
  const date = [
    now.getFullYear().toString(),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0")
  ].join("");
  const time = [
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0")
  ].join("");
  return `${date}-${time}`;
};

export const pickRecorderMimeType = (
  isTypeSupported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)
): string | undefined => {
  for (const candidate of MIME_CANDIDATES) {
    if (isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

export const extensionForMime = (mimeType: string): string => {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  switch (base) {
    case "audio/mp4":
    case "video/mp4":
      return "m4a";
    case "audio/aac":
      return "aac";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/webm":
    case "video/webm":
      return "webm";
    default:
      return "webm";
  }
};

const defaultDownload: RecorderDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

export class DriveRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream;
  private mimeType: string | undefined;
  private chunks: BlobPart[] = [];
  private retainChunks = false;
  private readonly download: RecorderDownload;

  constructor(stream: MediaStream, options: DriveRecorderOptions = {}) {
    this.stream = stream;
    this.mimeType = pickRecorderMimeType();
    this.download = options.download ?? defaultDownload;
  }

  start(): boolean {
    if (typeof MediaRecorder === "undefined") {
      return false;
    }

    if (this.recorder && this.recorder.state === "recording") {
      return true;
    }

    this.chunks = [];
    this.retainChunks = true;
    try {
      this.recorder = this.mimeType
        ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
        : new MediaRecorder(this.stream);
    } catch {
      try {
        this.mimeType = undefined;
        this.recorder = new MediaRecorder(this.stream);
      } catch {
        this.recorder = null;
        this.retainChunks = false;
        return false;
      }
    }

    this.mimeType = this.recorder.mimeType || this.mimeType;
    this.recorder.addEventListener("dataavailable", (event: BlobEvent) => {
      if (this.retainChunks && event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });
    this.recorder.start(TIMESLICE_MS);
    return true;
  }

  /** Discard the in-progress take without downloading. */
  discard(): void {
    this.retainChunks = false;
    this.chunks = [];
    if (!this.recorder) {
      return;
    }
    if (this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        // Recorder may already be stopping.
      }
    }
    this.recorder = null;
  }

  /** Discard without downloading. Prefer stopAndSave() when ending a take. */
  stop(): void {
    this.discard();
  }

  async stopAndSave(): Promise<boolean> {
    if (!this.recorder || this.recorder.state !== "recording") {
      return false;
    }

    const blob = await this.finalizeActiveRecorder();
    if (blob.size <= 0) {
      return false;
    }
    this.downloadBlob(blob);
    return true;
  }

  async saveThisDriveAndRestart(): Promise<boolean> {
    if (!this.recorder || this.recorder.state !== "recording") {
      return false;
    }

    const blob = await this.finalizeActiveRecorder();
    if (blob.size <= 0) {
      return false;
    }
    this.downloadBlob(blob);
    return this.start();
  }

  private finalizeActiveRecorder(): Promise<Blob> {
    const activeRecorder = this.recorder;
    if (!activeRecorder) {
      return Promise.resolve(new Blob([], { type: "audio/webm" }));
    }

    return new Promise((resolve) => {
      activeRecorder.addEventListener(
        "stop",
        () => {
          const mime = activeRecorder.mimeType || this.mimeType || "audio/webm";
          const blob = new Blob(this.chunks, { type: mime });
          this.chunks = [];
          this.recorder = null;
          resolve(blob);
        },
        { once: true }
      );
      activeRecorder.stop();
    });
  }

  private downloadBlob(blob: Blob): void {
    const mime = blob.type || this.mimeType || "audio/webm";
    const filename = `roadost-${formatStamp()}.${extensionForMime(mime)}`;
    this.download(blob, filename);
  }
}
