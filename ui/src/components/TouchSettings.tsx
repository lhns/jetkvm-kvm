import type { ReactNode } from "react";
import { CheckCircleIcon } from "@heroicons/react/16/solid";
import { CursorArrowRaysIcon } from "@heroicons/react/24/outline";

import { cx } from "@/cva.config";
import PointingFinger from "@assets/pointing-finger.svg";
import { type TouchInput, useSettingsStore } from "@hooks/stores";
import { GridCard } from "@components/Card";
import { SettingsItem } from "@components/SettingsItem";
import { m } from "@localizations/messages.js";

function TouchOption({
  value,
  icon,
  title,
  description,
}: {
  value: TouchInput;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  const { touchInput, setTouchInput } = useSettingsStore();
  return (
    <button className="group block grow" onClick={() => setTouchInput(value)}>
      <GridCard>
        <div className="flex w-full items-center gap-x-4 px-4 py-3">
          {icon}
          <div className="flex grow items-center justify-between">
            <div className="text-left">
              <h3 className="text-sm font-semibold text-black dark:text-white">{title}</h3>
              <p className="text-xs leading-tight text-slate-800 dark:text-slate-300">
                {description}
              </p>
            </div>
            <CheckCircleIcon
              className={cx(
                "h-4 w-4 shrink-0 text-blue-700 opacity-0 transition dark:text-blue-500",
                {
                  "opacity-100": touchInput === value,
                },
              )}
            />
          </div>
        </div>
      </GridCard>
    </button>
  );
}

export default function TouchSettings() {
  return (
    <div className="space-y-4">
      <SettingsItem title={m.touch_input_title()} description={m.touch_input_description()} />
      <div className="flex items-center gap-4">
        <TouchOption
          value="direct"
          icon={
            <img
              className="w-6 shrink-0 dark:invert"
              src={PointingFinger}
              alt={m.mouse_alt_finger()}
            />
          }
          title={m.touch_input_direct()}
          description={m.touch_input_direct_description()}
        />
        <TouchOption
          value="trackpad"
          icon={<CursorArrowRaysIcon aria-hidden className="w-6 shrink-0 dark:text-white" />}
          title={m.touch_input_trackpad()}
          description={m.touch_input_trackpad_description()}
        />
      </div>
    </div>
  );
}
