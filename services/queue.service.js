const { log } = require("../utils/logger");

/**
 * Serial queue — only one Playwright automation runs at a time.
 */
class QueueService {
  constructor() {
    this.queue = [];
    this.running = false;
    this.activeTask = null;
  }

  size() {
    return this.queue.length;
  }

  isBusy() {
    return this.running;
  }

  getStatus() {
    return {
      running: this.running,
      activeTask: this.activeTask,
      pending: this.queue.length,
    };
  }

  /**
   * @param {string} name
   * @param {() => Promise<any>} fn
   */
  enqueue(name, fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ name, fn, resolve, reject });
      log({
        event: "QUEUE_ENQUEUED",
        task: name,
        pending: this.queue.length,
      });
      this.#pump();
    });
  }

  async #pump() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      this.activeTask = job.name;

      log({
        event: "QUEUE_STARTED",
        task: job.name,
        pending: this.queue.length,
      });

      try {
        const result = await job.fn();
        log({
          event: "QUEUE_COMPLETED",
          task: job.name,
        });
        job.resolve(result);
      } catch (error) {
        log({
          event: "QUEUE_FAILED",
          task: job.name,
          error: error.message || String(error),
          code: error.code || null,
        });
        job.reject(error);
      } finally {
        this.activeTask = null;
      }
    }

    this.running = false;
  }
}

const queueService = new QueueService();

module.exports = queueService;
