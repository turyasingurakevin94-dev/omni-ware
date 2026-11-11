/*
 * The phone's Back button inside an Android app (the native layer, src/native/start.ts; spec 07 §4).
 * Moved from sales.html's native layer (its job 1); shared by every new app, on its own stack (shell/nav.ts).
 *
 * One press undoes one thing, in this order, and never closes the app:
 *   1. a sheet is open        -> it closes
 *   2. a screen is on a tab   -> it pops (the one below shows)
 *   3. a tab other than Today -> Today
 *   4. Today, nothing open    -> the app goes to the background, so it reopens where it was
 *
 * The step is chosen here, apart from what it does, so a test can walk it without a phone.
 */

export type BackStep = 'sheet' | 'screen' | 'today' | 'background';

/** What Back can see and do. native.ts fills it from the sheet host, the stack and the App plugin. */
export interface BackUi {
  sheetOpen: boolean;
  /** How many screens are on the stack (1 = a tab's own root). */
  depth: number;
  /** The id of the screen at the bottom of the stack. */
  rootId: string;
  closeSheet(): void;
  pop(): void;
  today(): void;
  background(): void;
}

/** The step one press of Back takes now. */
export function backStep(ui: Pick<BackUi, 'sheetOpen' | 'depth' | 'rootId'>): BackStep {
  if (ui.sheetOpen) return 'sheet';
  if (ui.depth > 1) return 'screen';
  if (ui.rootId !== 'today') return 'today';
  return 'background';
}

/** One press of Back: takes the step and says which it took. */
export function pressBack(ui: BackUi): BackStep {
  const step = backStep(ui);
  if (step === 'sheet') ui.closeSheet();
  else if (step === 'screen') ui.pop();
  else if (step === 'today') ui.today();
  else ui.background();
  return step;
}
