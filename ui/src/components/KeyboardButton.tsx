import { FaKeyboard } from "react-icons/fa6";
import { LuKeyboard, LuTabletSmartphone } from "react-icons/lu";

import { useHidStore, useSettingsStore, useUiStore } from "@hooks/stores";
import { Button } from "@components/Button";
import { SplitButtonCaret, SplitButtonGroup, SplitButtonPrimary } from "@components/SplitButton";
import { openSystemKeyboard } from "@components/SystemKeyboardInput";
import { m } from "@localizations/messages.js";

/** The action bar's keyboard button; a split button on touch devices, which have two keyboards. */
export default function KeyboardButton() {
  const { isVirtualKeyboardEnabled, setVirtualKeyboardEnabled } = useHidStore();
  const lastKeyboard = useSettingsStore(s => s.lastKeyboard);

  if (navigator.maxTouchPoints === 0) {
    return (
      <Button
        size="XS"
        theme="light"
        text={m.action_bar_virtual_keyboard()}
        LeadingIcon={FaKeyboard}
        onClick={() => setVirtualKeyboardEnabled(!isVirtualKeyboardEnabled)}
      />
    );
  }

  const toggle = () => {
    const field = useUiStore.getState().systemKeyboardInput;
    if (isVirtualKeyboardEnabled) setVirtualKeyboardEnabled(false);
    else if (field && document.activeElement === field) field.blur();
    else if (lastKeyboard === "system") openSystemKeyboard();
    else setVirtualKeyboardEnabled(true);
  };

  return (
    <SplitButtonGroup>
      <SplitButtonPrimary
        label={m.action_bar_virtual_keyboard()}
        icon={lastKeyboard === "system" ? LuTabletSmartphone : FaKeyboard}
        // Android focuses a tapped button, which would blur the field and turn "close" into "reopen".
        onMouseDown={e => e.preventDefault()}
        onClick={toggle}
      />
      <SplitButtonCaret
        modal={false}
        menuItems={[
          {
            label: m.keyboard_pc(),
            icon: LuKeyboard,
            onClick: () => setVirtualKeyboardEnabled(true),
            active: lastKeyboard === "pc",
          },
          {
            label: m.keyboard_system(),
            icon: LuTabletSmartphone,
            onClick: openSystemKeyboard,
            active: lastKeyboard === "system",
          },
        ]}
      />
    </SplitButtonGroup>
  );
}
