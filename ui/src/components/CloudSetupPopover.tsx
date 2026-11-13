import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { LuCheck, LuCopy, LuServerCog } from "react-icons/lu";

import { Button } from "@components/Button";
import Card from "@components/Card";
import { useCopyToClipboard } from "@components/useCopyToClipBoard";
import { CLOUD_API } from "@/ui.config";
import { m } from "@localizations/messages.js";

function CopyRow({ label, value }: { label: string; value: string }) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-600 dark:text-slate-400">{label}</div>
      <div className="flex items-center">
        <div className="flex h-[34px] min-w-0 grow items-center rounded-l-md border border-slate-800/20 bg-slate-50 px-3 font-mono text-xs text-black select-all dark:border-slate-300/20 dark:bg-slate-800 dark:text-white">
          <span className="truncate">{value}</span>
        </div>
        <Button
          className="rounded-l-none border-l-slate-800/30 dark:border-slate-300/20"
          size="SM"
          type="button"
          theme="light"
          LeadingIcon={isCopied ? LuCheck : LuCopy}
          text={isCopied ? m.cloud_setup_copied() : m.cloud_setup_copy()}
          onClick={() => copy(value)}
        />
      </div>
    </div>
  );
}

// Cloud mode only. The API URL is the compiled-in VITE_CLOUD_API; the app URL is this page's origin.
// Values are rendered as React text children, never as HTML.
export default function CloudSetupPopover() {
  return (
    <Popover className="relative">
      <PopoverButton
        as={Button}
        size="SM"
        theme="light"
        LeadingIcon={LuServerCog}
        text={m.cloud_setup_title()}
      />
      <PopoverPanel
        transition
        anchor="bottom end"
        className="z-50 mt-1 w-96 max-w-[calc(100vw-2rem)] p-px focus:outline-hidden data-closed:opacity-0"
      >
        <Card className="space-y-3 p-3 dark:text-white">
          <CopyRow label={m.access_cloud_api_url_label()} value={CLOUD_API} />
          <CopyRow label={m.access_cloud_app_url_label()} value={window.location.origin} />
          <p className="text-xs text-slate-600 dark:text-slate-400">{m.cloud_setup_hint()}</p>
        </Card>
      </PopoverPanel>
    </Popover>
  );
}
