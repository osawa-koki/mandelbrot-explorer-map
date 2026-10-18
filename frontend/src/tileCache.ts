/** 閉じる必要がある値（ImageBitmap など） */
interface Closable {
  close(): void;
}

/** 最近使ったものを残すキャッシュ。あふれた値は `close()` してから捨てる */
export class LruCache<V extends Closable> {
  private readonly map = new Map<string, V>();

  constructor(private readonly capacity: number) {}

  get size(): number {
    return this.map.size;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  /** 値を返し、最近使ったものとして扱う */
  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    const old = this.map.get(key);
    if (old !== undefined && old !== value) old.close();
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      // Map は挿入順に並ぶので、先頭がいちばん古い
      const [oldestKey, oldest] = this.map.entries().next().value!;
      this.map.delete(oldestKey);
      oldest.close();
    }
  }
}
