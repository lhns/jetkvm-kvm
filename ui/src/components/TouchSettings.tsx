import { useSettingsStore } from "@hooks/stores";
import { Checkbox } from "@components/Checkbox";
import { SelectMenuBasic } from "@components/SelectMenuBasic";
import { SettingsItem } from "@components/SettingsItem";
import { m } from "@localizations/messages.js";

const SENSITIVITIES = [0.5, 0.75, 1, 1.5, 2, 3];
const TAP_DELAYS = [100, 150, 180, 250, 350, 500];
const LONG_PRESSES = [350, 450, 550, 700, 900];

/** A saved number that is no longer on offer stays selectable instead of snapping to the first. */
const numberOptions = (values: number[], current: number, label: (v: number) => string) =>
  (values.includes(current) ? values : [...values, current].sort((a, b) => a - b)).map(v => ({
    value: String(v),
    label: label(v),
  }));

export default function TouchSettings() {
  const {
    touchStyle,
    setTouchStyle,
    touchSensitivity,
    setTouchSensitivity,
    touchTapDrag,
    setTouchTapDrag,
    touchTapDelay,
    setTouchTapDelay,
    touchLongPress,
    setTouchLongPress,
  } = useSettingsStore();
  const ms = (v: number) => m.touch_ms({ ms: v });

  return (
    <div className="space-y-4">
      <SettingsItem title={m.touch_title()} description={m.touch_description()} />
      <SettingsItem title={m.touch_style_title()} description={m.touch_style_description()}>
        <SelectMenuBasic
          size="SM"
          label=""
          value={touchStyle}
          onChange={e => setTouchStyle(e.target.value)}
          options={[
            { value: "touchpad", label: m.touch_style_touchpad() },
            { value: "direct", label: m.touch_style_direct() },
          ]}
        />
      </SettingsItem>
      <SettingsItem
        title={m.touch_sensitivity_title()}
        description={m.touch_sensitivity_description()}
      >
        <SelectMenuBasic
          size="SM"
          label=""
          value={String(touchSensitivity)}
          onChange={e => setTouchSensitivity(Number(e.target.value))}
          options={numberOptions(SENSITIVITIES, touchSensitivity, v => `${v}x`)}
        />
      </SettingsItem>
      <SettingsItem title={m.touch_tap_drag_title()} description={m.touch_tap_drag_description()}>
        <Checkbox checked={touchTapDrag} onChange={e => setTouchTapDrag(e.target.checked)} />
      </SettingsItem>
      <SettingsItem title={m.touch_tap_delay_title()} description={m.touch_tap_delay_description()}>
        <SelectMenuBasic
          size="SM"
          label=""
          value={String(touchTapDelay)}
          disabled={!touchTapDrag}
          onChange={e => setTouchTapDelay(Number(e.target.value))}
          options={numberOptions(TAP_DELAYS, touchTapDelay, ms)}
        />
      </SettingsItem>
      <SettingsItem
        title={m.touch_long_press_title()}
        description={m.touch_long_press_description()}
      >
        <SelectMenuBasic
          size="SM"
          label=""
          value={String(touchLongPress)}
          onChange={e => setTouchLongPress(Number(e.target.value))}
          options={numberOptions(LONG_PRESSES, touchLongPress, ms)}
        />
      </SettingsItem>
    </div>
  );
}
