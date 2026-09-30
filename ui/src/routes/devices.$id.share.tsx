import { Form, useActionData, useLoaderData } from "react-router";
import type {
  ActionFunction,
  ActionFunctionArgs,
  LoaderFunction,
  LoaderFunctionArgs,
} from "react-router";
import { ChevronLeftIcon } from "@heroicons/react/16/solid";

import { User } from "@hooks/stores";
import { Button, LinkButton } from "@components/Button";
import Card from "@components/Card";
import { CardHeader } from "@components/CardHeader";
import DashboardNavbar from "@components/Header";
import Fieldset from "@components/Fieldset";
import { InputFieldWithLabel } from "@components/InputField";
import { checkAuth } from "@/main";
import { CLOUD_API } from "@/ui.config";
import api from "@/api";
import { m } from "@localizations/messages.js";

interface Share {
  id: string;
  email: string;
  accepted: boolean;
  allowed: boolean;
}

interface LoaderData {
  device: { id: string; name: string };
  shares: Share[];
  ownerConsent: boolean;
  user: User;
}

const action: ActionFunction = async ({ params, request }: ActionFunctionArgs) => {
  const { id } = params;
  const form = await request.formData();
  const intent = form.get("intent");
  const email = form.get("email") as string;
  const shareId = form.get("shareId") as string;

  try {
    const res =
      intent === "remove"
        ? await api.DELETE(`${CLOUD_API}/devices/${id}/shares/${shareId}`)
        : await api.POST(`${CLOUD_API}/devices/${id}/shares`, { email });
    if (!res.ok) {
      const { message } = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      return {
        message: m.share_device_error({ error: message || res.statusText }),
      };
    }
  } catch (e) {
    console.error(e);
    return { message: m.share_device_error({ error: String(e) }) };
  }

  return null;
};

const loader: LoaderFunction = async ({ params }: LoaderFunctionArgs) => {
  const user = await checkAuth();
  const { id } = params;

  const [deviceRes, sharesRes] = await Promise.all([
    api.GET(`${CLOUD_API}/devices/${id}`),
    api.GET(`${CLOUD_API}/devices/${id}/shares`),
  ]);
  // Share management is the owner's; a shared user gets a 404 here.
  if (!deviceRes.ok || !sharesRes.ok) throw new Response("Device not found", { status: 404 });

  const { device } = await deviceRes.json();
  const { shares, ownerConsent } = await sharesRes.json();
  return { device, shares, ownerConsent, user };
};

export default function DeviceIdShare() {
  const { device, shares, ownerConsent, user } = useLoaderData() as LoaderData;
  const error = useActionData() as { message: string } | null;

  return (
    <div className="grid min-h-screen grid-rows-(--grid-layout)">
      <DashboardNavbar
        isLoggedIn={!!user}
        primaryLinks={[{ title: "Cloud Devices", to: "/devices" }]}
        userEmail={user?.email}
        picture={user?.picture}
        kvmName={device?.name}
      />

      <div className="h-full w-full">
        <div className="mt-4">
          <div className="mx-auto h-full w-full space-y-6 px-4 sm:max-w-6xl sm:px-8 md:max-w-7xl md:px-12 lg:max-w-8xl">
            <div className="space-y-4">
              <LinkButton
                size="SM"
                theme="blank"
                LeadingIcon={ChevronLeftIcon}
                text={m.back_to_devices()}
                to="/devices"
              />
              <Card className="max-w-3xl p-6">
                <div className="space-y-6">
                  <CardHeader
                    headline={m.share_device_headline({
                      name: device.name || device.id,
                    })}
                    description={m.share_device_description()}
                  />

                  {!ownerConsent && (
                    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-900/20">
                      <p className="text-sm font-semibold text-black dark:text-white">
                        {m.share_device_consent_title()}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {m.share_device_consent_description()}
                      </p>
                      <form action={`${CLOUD_API}/oidc/google`} method="POST">
                        <input type="hidden" name="consent" value="1" />
                        <input
                          type="hidden"
                          name="returnTo"
                          value={`${window.location.origin}/devices/${device.id}/share`}
                        />
                        <Button
                          size="SM"
                          theme="light"
                          type="submit"
                          text={m.share_device_consent_button()}
                        />
                      </form>
                    </div>
                  )}

                  <Fieldset>
                    <Form method="POST" className="max-w-sm space-y-4">
                      <input type="hidden" name="intent" value="add" />
                      <InputFieldWithLabel
                        label={m.share_device_email_label()}
                        type="email"
                        name="email"
                        placeholder={m.share_device_email_placeholder()}
                        size="MD"
                        required
                      />
                      <Button
                        size="MD"
                        theme="primary"
                        type="submit"
                        text={m.share_device_add()}
                        textAlign="center"
                      />
                    </Form>
                  </Fieldset>

                  {error?.message && (
                    <p className="text-sm text-red-500 dark:text-red-400">{error.message}</p>
                  )}

                  <div className="divide-y divide-slate-800/20 dark:divide-slate-300/20">
                    {shares.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {m.share_device_none()}
                      </p>
                    ) : (
                      shares.map(share => (
                        <div
                          key={share.id}
                          className="flex items-center justify-between gap-x-4 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-black dark:text-white">
                              {share.email}
                            </p>
                            {!share.allowed ? (
                              <p className="text-xs text-red-500 dark:text-red-400">
                                {m.share_device_not_allowed()}
                              </p>
                            ) : !share.accepted ? (
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {m.share_device_pending()}
                              </p>
                            ) : null}
                          </div>
                          <Form method="POST">
                            <input type="hidden" name="shareId" value={share.id} />
                            <Button
                              size="SM"
                              theme="danger"
                              type="submit"
                              name="intent"
                              value="remove"
                              text={m.share_device_remove()}
                            />
                          </Form>
                        </div>
                      ))
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {m.share_device_revoke_note()}
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

DeviceIdShare.loader = loader;
DeviceIdShare.action = action;
