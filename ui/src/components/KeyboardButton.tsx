import { FaKeyboard } from "react-icons/fa6";
import { LuKeyboard, LuTabletSmartphone } from "react-icons/lu";

import { Button } from "@components/Button";
import { SplitButtonCaret, SplitButtonGroup, SplitButtonPrimary } from "@components/SplitButton";
import useKeyboardChoice from "@hooks/useKeyboardChoice";
import { m } from "@localizations/messages.js";

/** The action bar's keyboard button; a split button on touch devices, where there are two keyboards. */
export default function KeyboardButton() {
  const { touch, lastKeyboard, openPc, openSystem, toggle } = useKeyboardChoice();

  if (!touch) {
    return (
      <Button
        size="XS"
        theme="light"
        text={m.action_bar_virtual_keyboard()}
        LeadingIcon={FaKeyboard}
        onClick={toggle}
      />
    );
  }

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
            onClick: openPc,
            active: lastKeyboard === "pc",
          },
          {
            label: m.keyboard_system(),
            icon: LuTabletSmartphone,
            onClick: openSystem,
            active: lastKeyboard === "system",
          },
        ]}
      />
    </SplitButtonGroup>
  );
}
