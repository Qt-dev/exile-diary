import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { electronService } from '../../../electron.service';
import './HotkeySettings.css';
import '../SettingsCommon.css';

const HotkeySettings = ({ settings, revalidate }) => {
  // Shortcut configurations
  const [runParseShortcut, setRunParseShortcut] = React.useState(
    settings.runParseShortcut || 'CommandOrControl+F10'
  );
  const [screenshotShortcut, setScreenshotShortcut] = React.useState(
    settings.screenshotShortcut || 'CommandOrControl+F8'
  );
  const [overlayToggleShortcut, setOverlayToggleShortcut] = React.useState(
    settings.overlayToggleShortcut || 'CommandOrControl+F7'
  );
  const [overlayMovementShortcut, setOverlayMovementShortcut] = React.useState(
    settings.overlayMovementShortcut || 'CommandOrControl+F9'
  );

  const [activeShortcutField, setActiveShortcutField] = React.useState<string | null>(null);

  // Get enable/disable states from settings to disable fields when appropriate
  const enableScreenshotCustomShortcut =
    settings.screenshots && !!settings.screenshots.allowCustomShortcut;
  const runParseScreenshotEnabled = !!settings.runParseScreenshotEnabled;

  // Track if there are unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    return (
      runParseShortcut !== (settings.runParseShortcut || 'CommandOrControl+F10') ||
      screenshotShortcut !== (settings.screenshotShortcut || 'CommandOrControl+F8') ||
      overlayToggleShortcut !== (settings.overlayToggleShortcut || 'CommandOrControl+F7') ||
      overlayMovementShortcut !== (settings.overlayMovementShortcut || 'CommandOrControl+F9')
    );
  }, [
    runParseShortcut,
    screenshotShortcut,
    overlayToggleShortcut,
    overlayMovementShortcut,
    settings,
  ]);

  const formatKeyStroke = (event: KeyboardEvent) => {
    const modifiers: string[] = [];
    if (event.ctrlKey || event.metaKey) modifiers.push('CommandOrControl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');

    let key = event.key;

    // Handle special keys
    const keyMap: { [key: string]: string } = {
      ' ': 'Space',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Enter: 'Return',
      Backspace: 'Backspace',
      Delete: 'Delete',
      Tab: 'Tab',
      Insert: 'Insert',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
    };

    if (keyMap[key]) {
      key = keyMap[key];
    } else if (key.startsWith('F') && /^F[0-9]+$/.test(key)) {
      // F1, F2, etc. - keep as is
    } else if (key.length === 1) {
      key = key.toUpperCase();
    } else if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
      return null; // Don't capture modifier keys alone
    }

    // Require at least one modifier for most keys (except function keys and special keys)
    if (modifiers.length === 0 && !key.startsWith('F') && !keyMap[event.key]) {
      return null;
    }

    return modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
  };

  const handleShortcutKeyDown = (event: React.KeyboardEvent) => {
    if (!activeShortcutField) return;

    event.preventDefault();
    event.stopPropagation();

    // Handle Escape key to cancel recording
    if (event.key === 'Escape') {
      setActiveShortcutField(null);
      (event.target as HTMLElement).blur();
      return;
    }

    const formatted = formatKeyStroke(event.nativeEvent);
    if (formatted) {
      switch (activeShortcutField) {
        case 'runParse':
          setRunParseShortcut(formatted);
          break;
        case 'screenshot':
          setScreenshotShortcut(formatted);
          break;
        case 'overlayToggle':
          setOverlayToggleShortcut(formatted);
          break;
        case 'overlayMovement':
          setOverlayMovementShortcut(formatted);
          break;
      }
      setActiveShortcutField(null);
      (event.target as HTMLElement).blur();
    }
  };

  const handleShortcutFocus = (fieldName: string) => {
    electronService.disableHotkeys();
    setActiveShortcutField(fieldName);
  };

  const handleShortcutBlur = () => {
    setActiveShortcutField(null);
    electronService.enableHotkeys();
  };

  const getShortcutValue = (fieldName: string) => {
    switch (fieldName) {
      case 'runParse':
        return runParseShortcut;
      case 'screenshot':
        return screenshotShortcut;
      case 'overlayToggle':
        return overlayToggleShortcut;
      case 'overlayMovement':
        return overlayMovementShortcut;
      default:
        return '';
    }
  };

  const ShortcutTextField = ({
    fieldName,
    label,
    helperText,
    enabled = true,
  }: {
    fieldName: string;
    label: string;
    helperText: string;
    enabled?: boolean;
  }) => {
    const isActiveField = activeShortcutField === fieldName;
    const currentValue = getShortcutValue(fieldName);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (isActiveField) {
        inputRef.current?.focus();
      }
    }, [isActiveField]);

    return (
      <TextField
        inputRef={inputRef}
        fullWidth
        label={isActiveField ? 'Press your desired key combination...' : label}
        name={`${fieldName}_shortcut`}
        variant="filled"
        size="small"
        value={isActiveField ? 'Recording...' : currentValue}
        onKeyDown={handleShortcutKeyDown}
        onFocus={() => handleShortcutFocus(fieldName)}
        onBlur={handleShortcutBlur}
        disabled={!enabled}
        helperText={
          isActiveField
            ? 'Press any key combination (e.g., Ctrl+F10, Alt+R). Press Escape to cancel.'
            : helperText
        }
        InputProps={{
          readOnly: true,
          style: {
            backgroundColor: isActiveField ? '#ffebee' : undefined,
            color: isActiveField ? '#d32f2f' : undefined,
          },
        }}
      />
    );
  };

  const handleResetShortcuts = () => {
    setRunParseShortcut('CommandOrControl+F10');
    setScreenshotShortcut('CommandOrControl+F8');
    setOverlayToggleShortcut('CommandOrControl+F7');
    setOverlayMovementShortcut('CommandOrControl+F9');
  };

  const handleCancel = () => {
    // Reset all shortcuts to original settings values
    setRunParseShortcut(settings.runParseShortcut || 'CommandOrControl+F10');
    setScreenshotShortcut(settings.screenshotShortcut || 'CommandOrControl+F8');
    setOverlayToggleShortcut(settings.overlayToggleShortcut || 'CommandOrControl+F7');
    setOverlayMovementShortcut(settings.overlayMovementShortcut || 'CommandOrControl+F9');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = {
      runParseShortcut: runParseShortcut,
      screenshotShortcut: screenshotShortcut,
      overlayToggleShortcut: overlayToggleShortcut,
      overlayMovementShortcut: overlayMovementShortcut,
    };

    // Save settings
    await electronService.saveSettings(data);
    revalidate();
  };

  return (
    <form onSubmit={handleSubmit} role="tabpanel">
      <h3 className="Settings__Header">Hotkey Configuration</h3>
      <Divider sx={{ mb: 3 }} />

      <Stack spacing={3}>
        {/* Overlay Controls */}
        <Box>
          <h4 style={{ marginBottom: '10px' }}>Overlay Controls</h4>
          <Stack spacing={2}>
            <ShortcutTextField
              fieldName="overlayToggle"
              label="Toggle Overlay Visibility"
              helperText="Hotkey to show/hide the overlay"
            />
            <ShortcutTextField
              fieldName="overlayMovement"
              label="Toggle Overlay Movement Mode"
              helperText="Hotkey to enable/disable moving the overlay"
            />
          </Stack>
        </Box>

        <Divider />

        {/* Screenshot */}
        <Box>
          <h4 style={{ marginBottom: '10px' }}>Screenshot</h4>
          {!enableScreenshotCustomShortcut && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#fff3cd', borderRadius: 1 }}>
              <em>
                Note: Custom screenshot shortcut is disabled. Enable it in the Account tab to
                configure.
              </em>
            </Box>
          )}
          <ShortcutTextField
            fieldName="screenshot"
            label="Take Screenshot"
            helperText={
              enableScreenshotCustomShortcut
                ? 'Hotkey to capture a screenshot'
                : 'Enable custom shortcut in Account tab first'
            }
            enabled={enableScreenshotCustomShortcut}
          />
        </Box>

        <Divider />

        {/* Run Completion */}
        <Box>
          <h4 style={{ marginBottom: '10px' }}>Run Completion</h4>
          {!runParseScreenshotEnabled && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#fff3cd', borderRadius: 1 }}>
              <em>
                Note: Run completion shortcut is disabled. Enable it in the Account tab to
                configure.
              </em>
            </Box>
          )}
          <ShortcutTextField
            fieldName="runParse"
            label="Finish Current Run"
            helperText={
              runParseScreenshotEnabled
                ? 'Hotkey to manually end the current map run'
                : 'Enable run completion shortcut in Account tab first'
            }
            enabled={runParseScreenshotEnabled}
          />
        </Box>

        <Divider />

        {/* Reset Button */}
        <Box>
          <Button variant="outlined" color="secondary" onClick={handleResetShortcuts} fullWidth>
            Reset All Shortcuts to Defaults
          </Button>
        </Box>

        {/* Save/Cancel Buttons */}
        <ButtonGroup variant="outlined" fullWidth aria-label="Settings Control Buttons">
          <Button
            type="submit"
            variant={hasUnsavedChanges ? 'contained' : 'outlined'}
            className={hasUnsavedChanges ? 'Settings__Save-Button--unsaved' : ''}
          >
            {hasUnsavedChanges ? 'Save Changes' : 'Save'}
          </Button>
          <Button onClick={handleCancel}>Cancel</Button>
        </ButtonGroup>
      </Stack>
    </form>
  );
};

export default HotkeySettings;
