import {
  formatRecapDuration,
  recapToText,
  type DriveRecap
} from "../recap/recap";

export type RecapCallbacks = {
  onCopyLink: () => void;
  onCopyText: (text: string) => void;
};

export class RecapPanel {
  private readonly container: HTMLElement;
  private readonly callbacks: RecapCallbacks;

  constructor(container: HTMLElement, callbacks: RecapCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.container.hidden = true;
  }

  render(recap: DriveRecap): void {
    this.container.hidden = false;
    this.container.innerHTML = `
      <div class="section-heading">
        <div>
          <p class="eyebrow">Drive recap</p>
          <h2>Your road, scored.</h2>
        </div>
        <span class="local-pill">Local only</span>
      </div>
      <div class="recap-grid">
        <article><span>Duration</span><strong>${formatRecapDuration(recap.durationSec)}</strong></article>
        <article><span>Avg speed</span><strong>${(recap.avgSpeedMps * 2.23694).toFixed(0)} mph</strong></article>
        <article><span>Peak speed</span><strong>${(recap.peakSpeedMps * 2.23694).toFixed(0)} mph</strong></article>
        <article><span>Peak energy</span><strong>${Math.round(recap.peakEnergy * 100)}%</strong></article>
        <article><span>Palette</span><strong>${recap.dominantPalette}</strong></article>
        <article><span>Rain time</span><strong>${Math.round(recap.rainFraction * 100)}%</strong></article>
      </div>
      <div class="section-timeline" aria-label="Section timeline">
        ${recap.sections
          .map(
            (item) =>
              `<span class="section-block section-${item.section}">${item.section}<b>${item.bars} ${item.bars === 1 ? "bar" : "bars"}</b></span>`
          )
          .join("")}
      </div>
      <div class="recap-actions">
        <button id="copy-drive-link" type="button">Copy drive link</button>
        <button id="copy-recap-text" type="button">Copy recap text</button>
      </div>
    `;

    this.container
      .querySelector<HTMLButtonElement>("#copy-drive-link")
      ?.addEventListener("click", this.callbacks.onCopyLink);
    this.container
      .querySelector<HTMLButtonElement>("#copy-recap-text")
      ?.addEventListener("click", () => this.callbacks.onCopyText(recapToText(recap)));
  }
}
