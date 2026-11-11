/**
 * Runs `task` without waiting for it: for side effects (emails) whose failure
 * must not undo what was just done. Failures are logged.
 */
export function inBackground(task: Promise<unknown>, what: string) {
  void task.catch((error) => console.error(`Could not ${what}`, error))
}
