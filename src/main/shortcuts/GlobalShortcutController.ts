import { globalShortcut } from 'electron';

type ShortcutDefinition = {
  accelerator: string;
  callback: () => void;
};

export type GlobalShortcutControllerDependencies = {
  getShortcut: (key: string) => string | null;
  isRunParseScreenshotEnabled: () => boolean;
  areCustomScreenshotsEnabled: () => boolean;
  toggleOverlayPersistence: () => void;
  toggleOverlayMovement: () => boolean;
  triggerRunParse: () => void;
  triggerScreenshot: () => void;
};

export class GlobalShortcutController {
  constructor(private readonly deps: GlobalShortcutControllerDependencies) {}

  registerAll() {
    for (const shortcut of this.getShortcutDefinitions()) {
      globalShortcut.register(shortcut.accelerator, shortcut.callback);
    }
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }

  reregisterAll() {
    this.unregisterAll();
    this.registerAll();
  }

  private getShortcutDefinitions(): ShortcutDefinition[] {
    const shortcuts: ShortcutDefinition[] = [
      {
        accelerator: this.deps.getShortcut('overlayToggleShortcut') || 'CommandOrControl+F7',
        callback: () => {
          this.deps.toggleOverlayPersistence();
        },
      },
      {
        accelerator: this.deps.getShortcut('overlayMovementShortcut') || 'CommandOrControl+F9',
        callback: () => {
          this.deps.toggleOverlayMovement();
        },
      },
    ];

    if (this.deps.isRunParseScreenshotEnabled()) {
      shortcuts.push({
        accelerator: this.deps.getShortcut('runParseShortcut') || 'CommandOrControl+F10',
        callback: () => {
          this.deps.triggerRunParse();
        },
      });
    }

    if (this.deps.areCustomScreenshotsEnabled()) {
      shortcuts.push({
        accelerator: this.deps.getShortcut('screenshotShortcut') || 'CommandOrControl+F8',
        callback: () => {
          this.deps.triggerScreenshot();
        },
      });
    }

    return shortcuts;
  }
}
