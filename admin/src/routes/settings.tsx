import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getSettings, updateSettings } from "@/lib/queries/admin-settings";
import { useAdminAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import type { StoreSettings } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const { data: settings, isLoading } = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettings });

  if (isLoading || !settings) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wide">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Changes here apply across the storefront immediately — including the WhatsApp number on every
          product's order button.
        </p>
      </div>

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Business Info</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="profile">Admin Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="business">
          <BusinessForm settings={settings} />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppForm settings={settings} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useSaveSettings() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  async function save(input: Partial<StoreSettings>) {
    setSaving(true);
    try {
      await updateSettings(input);
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }
  return { save, saving };
}

function BusinessForm({ settings }: { settings: StoreSettings }) {
  const [form, setForm] = useState(settings);
  const { save, saving } = useSaveSettings();

  useEffect(() => setForm(settings), [settings]);

  return (
    <div className="mt-4 max-w-xl space-y-4 rounded-lg border border-border bg-shell p-5">
      <Field label="Brand name">
        <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
      </Field>
      <Field label="Tagline">
        <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
      </Field>
      <Field label="Phone">
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="Location">
        <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      </Field>
      <Field label="Currency">
        <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
      </Field>
      <Field label="Low stock warning threshold (store default)">
        <Input
          type="number"
          min={0}
          value={form.low_stock_threshold}
          onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })}
        />
      </Field>
      <Button
        onClick={() =>
          save({
            brand_name: form.brand_name,
            tagline: form.tagline,
            phone: form.phone,
            location: form.location,
            currency: form.currency,
            low_stock_threshold: form.low_stock_threshold,
          })
        }
        disabled={saving}
      >
        {saving ? "Saving…" : "Save business info"}
      </Button>
    </div>
  );
}

function WhatsAppForm({ settings }: { settings: StoreSettings }) {
  const [form, setForm] = useState(settings);
  const { save, saving } = useSaveSettings();

  useEffect(() => setForm(settings), [settings]);

  return (
    <div className="mt-4 max-w-2xl space-y-4 rounded-lg border border-border bg-shell p-5">
      <Field label="WhatsApp number (international format, no +)">
        <Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
      </Field>
      <Field label="Order message greeting">
        <Input value={form.whatsapp_greeting} onChange={(e) => setForm({ ...form, whatsapp_greeting: e.target.value })} />
      </Field>
      <Field label="Order message closing">
        <Input value={form.whatsapp_closing} onChange={(e) => setForm({ ...form, whatsapp_closing: e.target.value })} />
      </Field>
      <Field label="Order message template (single-item orders)">
        <Textarea
          value={form.order_message_template}
          onChange={(e) => setForm({ ...form, order_message_template: e.target.value })}
          rows={10}
          className="font-mono text-xs"
        />
        <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
          Supported variables: {"{{productName}} {{color}} {{quantity}} {{price}} {{total}} {{customerName}} {{customerPhone}} {{location}} {{note}}"}
          . Multi-item cart orders use a similar layout with each item listed automatically. Lines like
          &ldquo;Note: {"{{note}}"}&rdquo; are left out when the customer didn&apos;t fill them in. Emojis are
          removed automatically, because some phones show them as &ldquo;?&rdquo; boxes.
        </p>
      </Field>
      <Button
        onClick={() =>
          save({
            whatsapp_number: form.whatsapp_number,
            whatsapp_greeting: form.whatsapp_greeting,
            whatsapp_closing: form.whatsapp_closing,
            order_message_template: form.order_message_template,
          })
        }
        disabled={saving}
      >
        {saving ? "Saving…" : "Save WhatsApp settings"}
      </Button>
    </div>
  );
}

function ProfileForm() {
  const { user } = useAdminAuth();
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setFullName(data?.full_name ?? ""));
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      if (error) throw error;
      if (newPassword.trim()) {
        if (newPassword.trim().length < 6) throw new Error("Password must be at least 6 characters.");
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword.trim() });
        if (pwError) throw pwError;
        setNewPassword("");
      }
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 max-w-md space-y-4 rounded-lg border border-border bg-shell p-5">
      <Field label="Email">
        <Input value={user?.email ?? ""} disabled />
      </Field>
      <Field label="Name">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Esther" />
      </Field>
      <Field label="New password (leave blank to keep current)">
        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </Field>
      <Button onClick={saveProfile} disabled={saving}>
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
