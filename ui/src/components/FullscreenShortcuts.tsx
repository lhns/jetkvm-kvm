import { useEffect, useMemo, useRef, useState } from "react";
import { LuCommand, LuKeyboard, LuTabletSmartphone } from "react-icons/lu";

import { useHidStore, useMacrosStore, useSettingsStore, useVideoStore } from "@hooks/stores";
import useKeyboard, { type MacroSteps } from "@hooks/useKeyboard";
import { useJsonRpc } from "@hooks/useJsonRpc";
import { useMultiTouchGestures } from "@hooks/useMultiTouchGestures";
import { Button } from "@components/Button";
import Card from "@components/Card";
import { openSystemKeyboard } from "@components/SystemKeyboardInput";
import VirtualKeyboard from "@components/VirtualKeyboard";
import { keys, modifiers } from "@/keyboardMappings";
import { blackBarSpot, resolveSwipeAction } from "@/utils/fullscreenShortcuts";
import { videoDisplayArea } from "@/utils/pointerMapping";
import { m } from "@localizations/messages.js";

const STICKY_MODIFIERS = [
  { key: "MetaLeft", label: "Win" },
  { key: "ControlLeft", label: "Ctrl" },
  { key: "AltLeft", label: "Alt" },
  { key: "ShiftLeft", label: "Shift" },
] as const;

/**
 * Touch shortcuts for fullscreen, rendered inside the fullscreen container so they exist in
 * native and pseudo fullscreen. Nothing is drawn over the video: three-finger swipes act
 * invisibly, a four-finger tap opens the menu, and a button appears only inside a black bar.
 */
export default function FullscreenShortcuts() {
  const { executeMacro, handleKeyPress, resetKeyboardState } = useKeyboard();
  const { macros, initialized, loadMacros, setSendFn } = useMacrosStore();
  const { send } = useJsonRpc();
  const { swipeLeftAction, swipeRightAction } = useSettingsStore();
  const { containerElement, width, height, clientWidth, clientHeight } = useVideoStore();
  const { keysDownState, setVirtualKeyboardEnabled } = useHidStore();
  const touch = navigator.maxTouchPoints > 0;
  const [menuOpen, setMenuOpen] = useState(false);

  // Leaving fullscreen unmounts this; a held sticky modifier would otherwise stay down on the remote.
  const resetRef = useRef(resetKeyboardState);
  resetRef.current = resetKeyboardState;
  useEffect(
    () => () => {
      const held = useHidStore.getState().keysDownState.modifier;
      if (STICKY_MODIFIERS.some(({ key }) => held & modifiers[key])) void resetRef.current();
    },
    [],
  );

  useEffect(() => {
    setSendFn(send);
    if (!initialized) loadMacros();
  }, [initialized, loadMacros, setSendFn, send]);

  useMultiTouchGestures(containerElement, g => {
    if (g.type === "menu") {
      setMenuOpen(open => !open);
      return;
    }
    const setting = g.direction === "left" ? swipeLeftAction : swipeRightAction;
    const steps = resolveSwipeAction(setting, g.direction, macros);
    if (steps) void executeMacro(steps);
  });

  const runMacro = (steps: MacroSteps) => {
    setMenuOpen(false);
    void executeMacro(steps);
  };

  const barSpot = useMemo(() => {
    const area = videoDisplayArea({ width: clientWidth, height: clientHeight }, width, height);
    return blackBarSpot(clientWidth, clientHeight, area.offsetX, area.offsetY);
  }, [clientWidth, clientHeight, width, height]);

  return (
    <>
      {barSpot && !menuOpen && (
        <button
          type="button"
          data-fs-overlay
          aria-label={m.fullscreen_menu_button()}
          title={m.fullscreen_menu_button()}
          // Keeps the System keyboard's field focused (Android focuses tapped buttons).
          onMouseDown={e => e.preventDefault()}
          onClick={() => setMenuOpen(true)}
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/25"
          style={{ left: barSpot.x, top: barSpot.y }}
        >
          <LuCommand className="size-4" />
        </button>
      )}

      {menuOpen && (
        <div
          data-fs-overlay
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={e => e.preventDefault()}
          onPointerDown={e => {
            if (e.target === e.currentTarget) setMenuOpen(false);
          }}
        >
          <Card className="max-h-full w-full max-w-md overflow-y-auto">
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {m.fullscreen_menu_macros()}
                </div>
                {macros.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {m.fullscreen_menu_no_macros()}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {macros.map(macro => (
                      <Button
                        key={macro.id}
                        size="SM"
                        theme="light"
                        text={macro.name}
                        data-testid="fs-macro"
                        onClick={() => runMacro(macro.steps)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {m.fullscreen_menu_modifiers()}
                </div>
                <div className="flex flex-wrap gap-2">
                  {STICKY_MODIFIERS.map(({ key, label }) => {
                    const down = (keysDownState.modifier & modifiers[key]) !== 0;
                    return (
                      <Button
                        key={key}
                        size="SM"
                        theme={down ? "primary" : "light"}
                        text={label}
                        data-testid={`fs-mod-${key}`}
                        onClick={() => void handleKeyPress(keys[key], !down)}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button
                    size="SM"
                    theme="light"
                    LeadingIcon={LuKeyboard}
                    text={touch ? m.keyboard_pc() : m.fullscreen_menu_keyboard()}
                    data-testid="fs-keyboard"
                    onClick={() => {
                      setMenuOpen(false);
                      setVirtualKeyboardEnabled(true);
                    }}
                  />
                  {touch && (
                    <Button
                      size="SM"
                      theme="light"
                      LeadingIcon={LuTabletSmartphone}
                      text={m.keyboard_system()}
                      data-testid="fs-keyboard-system"
                      onClick={() => {
                        setMenuOpen(false);
                        openSystemKeyboard();
                      }}
                    />
                  )}
                </div>
                <Button
                  size="SM"
                  theme="blank"
                  text={m.fullscreen_menu_close()}
                  data-testid="fs-close"
                  onClick={() => setMenuOpen(false)}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* The page's keyboard is outside the fullscreen element, so it is mounted here instead.
          Docked, it sits below the video in the container's column; detached, it is fixed. */}
      <div data-fs-overlay className="z-20 order-last w-full">
        <VirtualKeyboard mode="fullscreen" />
      </div>
    </>
  );
}
