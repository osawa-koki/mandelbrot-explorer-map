import type { WorkerRequest, WorkerResponse } from "./render.worker";

type Done = (key: string, bitmap: ImageBitmap) => void;

/**
 * タイルを計算する Worker の集まり。
 * 待ち行列は描画のたびに `setQueue` で丸ごと入れ替える（見えなくなったタイルは計算しない）。
 */
export class WorkerPool {
  private readonly idle: Worker[] = [];
  private readonly running = new Set<string>();
  private queue: WorkerRequest[] = [];
  private lastElapsedMs = 0;

  constructor(size: number, private readonly onDone: Done) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handle(worker, event.data);
      this.idle.push(worker);
    }
  }

  /** 計算中・待ち行列のタイルの数 */
  get pendingCount(): number {
    return this.running.size + this.queue.length;
  }

  /** 直近に計算したタイル 1 枚の所要時間（ミリ秒） */
  get lastTileMs(): number {
    return this.lastElapsedMs;
  }

  isRunning(key: string): boolean {
    return this.running.has(key);
  }

  /** 待ち行列を入れ替える（先頭ほど先に計算する）。計算中のタイルは除く */
  setQueue(requests: WorkerRequest[]): void {
    this.queue = requests.filter((r) => !this.running.has(r.key));
    this.dispatch();
  }

  private dispatch(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const req = this.queue.shift()!;
      this.running.add(req.key);
      worker.postMessage(req);
    }
  }

  private handle(worker: Worker, res: WorkerResponse): void {
    this.running.delete(res.key);
    this.idle.push(worker);
    if ("bitmap" in res) {
      this.lastElapsedMs = res.elapsedMs;
      this.onDone(res.key, res.bitmap);
    } else {
      console.error(`タイルの計算に失敗しました (${res.key}): ${res.error}`);
    }
    this.dispatch();
  }
}
