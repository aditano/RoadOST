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

const stopRecorder = (recorder: MediaRecorder): Promise<Blob> =>
  new Promise((resolve) => {
    const chunks: BlobPart[] = [];
    recorder.addEventListener(
      "dataavailable",
      (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      },
      { once: false }
    );
    recorder.addEventListener(
      "stop",
      () => {
        resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      },
      { once: true }
    );
    recorder.stop();
  });

export class DriveRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream;
  private mimeType: string;

  constructor(stream: MediaStream) {
    this.stream = stream;
    this.mimeType =
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
  }

  start(): boolean {
    if (typeof MediaRecorder === "undefined") {
      return false;
    }

    if (this.recorder && this.recorder.state === "recording") {
      return true;
    }

    this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
    this.recorder.start(300);
    return true;
  }

  stop(): void {
    if (!this.recorder || this.recorder.state !== "recording") {
      return;
    }
    this.recorder.stop();
  }

  async saveThisDriveAndRestart(): Promise<boolean> {
    if (!this.recorder || this.recorder.state !== "recording") {
      return false;
    }

    const activeRecorder = this.recorder;
    const blob = await stopRecorder(activeRecorder);
    this.downloadBlob(blob, `roadost-${formatStamp()}.webm`);
    this.start();
    return true;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}
