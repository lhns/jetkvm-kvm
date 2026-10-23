import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { AnimatePresence, motion } from "framer-motion";
import { KeyboardReact as Keyboard } from "react-simple-keyboard";
import { LuKeyboard } from "react-icons/lu";

import "react-simple-keyboard/build/css/index.css";
import DetachIconRaw from "@/assets/detach-icon.svg";
import { cx } from "@/cva.config";
import { useHidStore, useUiStore } from "@hooks/stores";
import useKeyboard from "@hooks/useKeyboard";
import useKeyboardFit from "@hooks/useKeyboardFit";
import useKeyboardLayout from "@hooks/useKeyboardLayout";
import { Button, LinkButton } from "@components/Button";
import Card from "@components/Card";
import { decodeModifiers, keys, latchingKeys, modifiers } from "@/keyboardMappings";
import { clampPosition, KeyboardMode } from "@/utils/keyboardFit";
import { m } from "@localizations/messages.js";

export const DetachIcon = ({ className }: { className?: string }) => {
  return <img src={DetachIconRaw} alt="Detach Icon" className={className} />;
};

interface KeyboardWrapperProps {
  /** Where the attached keyboard is mounted: in the page, or over the fullscreen video. */
  mode?: "page" | "fullscreen";
}

function visibleViewport() {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}

function KeyboardWrapper({ mode = "page" }: KeyboardWrapperProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const fitRootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { isAttachedVirtualKeyboardVisible, setAttachedVirtualKeyboardVisibility } = useUiStore();
  const { keyboardLedState, keysDownState, isVirtualKeyboardEnabled, setVirtualKeyboardEnabled } =
    useHidStore();
  const { handleKeyPress } = useKeyboard();
  const { selectedKeyboard } = useKeyboardLayout();

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [newPosition, setNewPosition] = useState({ x: 0, y: 0 });

  const fitMode: KeyboardMode = isAttachedVirtualKeyboardVisible ? mode : "detached";

  const keyDisplayMap = useMemo(() => {
    return selectedKeyboard.keyDisplayMap;
  }, [selectedKeyboard]);

  const virtualKeyboard = useMemo(() => {
    return selectedKeyboard.virtualKeyboard;
  }, [selectedKeyboard]);

  const { isShiftActive } = useMemo(() => {
    return decodeModifiers(keysDownState.modifier);
  }, [keysDownState]);

  const isCapsLockActive = useMemo(() => {
    return keyboardLedState.caps_lock;
  }, [keyboardLedState]);

  const mainLayoutName = useMemo(() => {
    // if you have the CapsLock "latched", then the shift state is inverted
    const effectiveShift = isCapsLockActive ? false === isShiftActive : isShiftActive;
    return effectiveShift ? "shift" : "default";
  }, [isCapsLockActive, isShiftActive]);

  const keyNamesForDownKeys = useMemo(() => {
    const activeModifierMask = keysDownState.modifier || 0;
    const modifierNames = Object.entries(modifiers)
      .filter(([_, mask]) => (activeModifierMask & mask) !== 0)
      .map(([name, _]) => name);

    const keysDown = keysDownState.keys || [];
    const keyNames = Object.entries(keys)
      .filter(([_, value]) => keysDown.includes(value))
      .map(([name, _]) => name);

    return [...modifierNames, ...keyNames, " "]; // we have to have at least one space to avoid keyboard whining
  }, [keysDownState]);

  const startDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!keyboardRef.current) return;
    if (e instanceof TouchEvent && e.touches.length > 1) return;
    setIsDragging(true);

    const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
    const clientY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;

    const rect = keyboardRef.current.getBoundingClientRect();
    setPosition({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  }, []);

  const onDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!keyboardRef.current) return;
      if (isDragging) {
        const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
        const clientY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;

        const newX = clientX - position.x;
        const newY = clientY - position.y;

        setNewPosition(
          clampPosition(
            { x: newX, y: newY },
            keyboardRef.current.getBoundingClientRect(),
            visibleViewport(),
          ),
        );
      }
    },
    [isDragging, position.x, position.y],
  );

  // A detached keyboard must stay on screen after a rotation, a resize or a size change.
  useEffect(() => {
    const element = keyboardRef.current;
    if (isAttachedVirtualKeyboardVisible || !isVirtualKeyboardEnabled || !element) return;

    const keepInside = () =>
      setNewPosition(current => {
        const next = clampPosition(current, element.getBoundingClientRect(), visibleViewport());
        return next.x === current.x && next.y === current.y ? current : next;
      });

    keepInside();
    const observer = new ResizeObserver(keepInside);
    observer.observe(element);
    window.addEventListener("resize", keepInside);
    window.visualViewport?.addEventListener("resize", keepInside);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", keepInside);
      window.visualViewport?.removeEventListener("resize", keepInside);
    };
  }, [isAttachedVirtualKeyboardVisible, isVirtualKeyboardEnabled]);

  useKeyboardFit({
    rootRef: fitRootRef,
    bodyRef,
    anchorRef,
    mode: fitMode,
    rows: virtualKeyboard.main.default.length,
    enabled: isVirtualKeyboardEnabled,
  });

  const endDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    // Is the keyboard detached or attached?
    if (isAttachedVirtualKeyboardVisible) return;

    const handle = keyboardRef.current;
    if (handle) {
      handle.addEventListener("touchstart", startDrag);
      handle.addEventListener("mousedown", startDrag);
    }

    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchend", endDrag);

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("touchmove", onDrag);

    return () => {
      if (handle) {
        handle.removeEventListener("touchstart", startDrag);
        handle.removeEventListener("mousedown", startDrag);
      }

      document.removeEventListener("mouseup", endDrag);
      document.removeEventListener("touchend", endDrag);

      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("touchmove", onDrag);
    };
  }, [isAttachedVirtualKeyboardVisible, endDrag, onDrag, startDrag]);

  const onKeyUp = useCallback(async (_: string, e: MouseEvent | undefined) => {
    e?.preventDefault();
    e?.stopPropagation();
  }, []);

  const onKeyDown = useCallback(
    async (key: string, e: MouseEvent | undefined) => {
      e?.preventDefault();
      e?.stopPropagation();

      // if they press any of the latching keys, we send a keypress down event and the release it automatically (on timer)
      if (latchingKeys.includes(key)) {
        console.debug(`Latching key pressed: ${key} sending down and delayed up pair`);
        void handleKeyPress(keys[key], true);
        setTimeout(() => void handleKeyPress(keys[key], false), 100);
        return;
      }

      // if they press any of the dynamic keys, we send a keypress down event but we don't release it until they click it again
      if (Object.keys(modifiers).includes(key)) {
        const currentlyDown = keyNamesForDownKeys.includes(key);
        console.debug(
          `Dynamic key pressed: ${key} was currently down: ${currentlyDown}, toggling state`,
        );
        void handleKeyPress(keys[key], !currentlyDown);
        return;
      }

      // otherwise, just treat it as a down+up pair
      const cleanKey = key.replace(/[()]/g, "");
      console.debug(`Regular key pressed: ${cleanKey} sending down and up pair`);
      void handleKeyPress(keys[cleanKey], true);
      setTimeout(() => void handleKeyPress(keys[cleanKey], false), 50);
    },
    [handleKeyPress, keyNamesForDownKeys],
  );

  return (
    <div ref={anchorRef}>
      <AnimatePresence>
        {isVirtualKeyboardEnabled && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: "0%" }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{
              duration: 0.5,
              ease: "easeInOut",
            }}
          >
            <div
              className={cx(
                !isAttachedVirtualKeyboardVisible
                  ? "fixed top-0 left-0 z-10 select-none"
                  : "relative",
              )}
              ref={keyboardRef}
              style={{
                ...(!isAttachedVirtualKeyboardVisible
                  ? { transform: `translate(${newPosition.x}px, ${newPosition.y}px)` }
                  : {}),
              }}
            >
              <Card
                ref={fitRootRef}
                className={cx(
                  "flex max-h-(--kb-max-h) flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]",
                  {
                    "rounded-none": isAttachedVirtualKeyboardVisible,
                    "keyboard-detached": !isAttachedVirtualKeyboardVisible,
                  },
                )}
              >
                <div className="flex min-h-[34px] shrink-0 items-center justify-center border-b border-b-slate-800/30 bg-white px-2 py-1.5 dark:border-b-slate-300/20 dark:bg-slate-800">
                  <div className="absolute left-2 flex items-center gap-x-2">
                    {isAttachedVirtualKeyboardVisible ? (
                      // Detaching a keyboard that overlays the fullscreen video is no use.
                      mode !== "fullscreen" && (
                        <Button
                          size="XS"
                          theme="light"
                          text={m.detach()}
                          onClick={() => setAttachedVirtualKeyboardVisibility(false)}
                        />
                      )
                    ) : (
                      <Button
                        size="XS"
                        theme="light"
                        text={m.attach()}
                        onClick={() => setAttachedVirtualKeyboardVisibility(true)}
                      />
                    )}
                  </div>
                  <h2 className="self-center font-sans text-sm leading-none font-medium text-slate-700 select-none dark:text-slate-300">
                    {m.virtual_keyboard_header()}
                  </h2>
                  <div className="absolute right-2 flex items-center gap-x-2">
                    <div className="hidden items-center gap-x-2 md:flex">
                      <LinkButton
                        size="XS"
                        to="settings/keyboard"
                        theme="light"
                        text={selectedKeyboard.name}
                        LeadingIcon={LuKeyboard}
                      />
                      <div className="h-[20px] w-px bg-slate-800/20 dark:bg-slate-200/20" />
                    </div>

                    <Button
                      size="XS"
                      theme="light"
                      text={m.hide()}
                      LeadingIcon={ChevronDownIcon}
                      onClick={() => setVirtualKeyboardEnabled(false)}
                    />
                  </div>
                </div>

                <div ref={bodyRef} className="min-h-0 overflow-y-auto">
                  <div className="kb-body bg-blue-50/80 dark:bg-slate-700">
                    <Keyboard
                      baseClass="simple-keyboard-main"
                      layoutName={mainLayoutName}
                      onKeyPress={onKeyDown}
                      onKeyReleased={onKeyUp}
                      buttonTheme={[
                        {
                          class: "down-key",
                          buttons: keyNamesForDownKeys.join(" "),
                        },
                      ]}
                      display={keyDisplayMap}
                      layout={virtualKeyboard.main}
                      disableButtonHold={true}
                      enableLayoutCandidates={false}
                      preventMouseDownDefault={true}
                      preventMouseUpDefault={true}
                      stopMouseDownPropagation={true}
                      stopMouseUpPropagation={true}
                    />

                    <div className="controlArrows">
                      <Keyboard
                        baseClass="simple-keyboard-control"
                        theme="simple-keyboard hg-theme-default hg-layout-default"
                        layoutName="default"
                        onKeyPress={onKeyDown}
                        onKeyReleased={onKeyUp}
                        display={keyDisplayMap}
                        layout={virtualKeyboard.control}
                        disableButtonHold={true}
                        enableLayoutCandidates={false}
                        preventMouseDownDefault={true}
                        preventMouseUpDefault={true}
                        stopMouseDownPropagation={true}
                        stopMouseUpPropagation={true}
                      />
                      <Keyboard
                        baseClass="simple-keyboard-arrows"
                        theme="simple-keyboard hg-theme-default hg-layout-default"
                        onKeyPress={onKeyDown}
                        onKeyReleased={onKeyUp}
                        display={keyDisplayMap}
                        layout={virtualKeyboard.arrows}
                        disableButtonHold={true}
                        enableLayoutCandidates={false}
                        preventMouseDownDefault={true}
                        preventMouseUpDefault={true}
                        stopMouseDownPropagation={true}
                        stopMouseUpPropagation={true}
                      />
                    </div>
                    {/* TODO add optional number pad */}
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default KeyboardWrapper;
