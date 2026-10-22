import { useEffect } from "react";

import { useMacrosStore, useSettingsStore } from "@hooks/stores";
import { useJsonRpc } from "@hooks/useJsonRpc";
import { SelectMenuBasic } from "@components/SelectMenuBasic";
import { SettingsItem } from "@components/SettingsItem";
import { macroSwipeValue, SWIPE_DEFAULT, SWIPE_OFF } from "@/utils/fullscreenShortcuts";
import { m } from "@localizations/messages.js";

/** What the fullscreen three-finger swipes do: Win+Shift+Arrow, one of the macros, or nothing. */
export default function SwipeActionSettings() {
  const { swipeLeftAction, setSwipeLeftAction, swipeRightAction, setSwipeRightAction } =
    useSettingsStore();
  const { macros, initialized, loadMacros, setSendFn } = useMacrosStore();
  const { send } = useJsonRpc();

  useEffect(() => {
    setSendFn(send);
    if (!initialized) loadMacros();
  }, [initialized, loadMacros, setSendFn, send]);

  const optionsFor = (arrow: string, current: string) => {
    const options = [
      { value: SWIPE_DEFAULT, label: m.swipe_action_win_shift_arrow({ arrow }) },
      { value: SWIPE_OFF, label: m.swipe_action_off() },
      ...macros.map(macro => ({ value: macroSwipeValue(macro.id), label: macro.name })),
    ];
    if (!options.some(o => o.value === current)) {
      options.push({ value: current, label: m.swipe_action_missing_macro() });
    }
    return options;
  };

  return (
    <div className="space-y-4">
      <SettingsItem title={m.swipe_left_title()} description={m.swipe_description()}>
        <SelectMenuBasic
          size="SM"
          label=""
          value={swipeLeftAction}
          onChange={e => setSwipeLeftAction(e.target.value)}
          options={optionsFor("←", swipeLeftAction)}
        />
      </SettingsItem>
      <SettingsItem title={m.swipe_right_title()} description={m.swipe_description()}>
        <SelectMenuBasic
          size="SM"
          label=""
          value={swipeRightAction}
          onChange={e => setSwipeRightAction(e.target.value)}
          options={optionsFor("→", swipeRightAction)}
        />
      </SettingsItem>
    </div>
  );
}
