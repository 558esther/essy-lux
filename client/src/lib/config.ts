import type { StoreSettings } from "@/lib/types";

/**
 * Fallback values used until the `settings` table has loaded (or if it's
 * ever unreachable). Once loaded, admin-configured values from Supabase take
 * over everywhere via the optional `settings` parameter on the helpers below.
 */
export const ESSY_LUX_CONFIG = {
  brandName: "ESSY-LUX",
  tagline: "LUXURY BAGS",
  phone: "0113835508",
  whatsappNumber: "254113835508",
  location: "Mombasa – Bamburi, Kenya",
  currency: "KES",
  instagramHandle: "@essylux",
  /** Set real links here when the accounts are confirmed. */
  social: {
    instagram: "",
    facebook: "",
    tiktok: "",
  },
} as const;

export function formatPrice(amount: number, currency: string = ESSY_LUX_CONFIG.currency) {
  return `${currency} ${amount.toLocaleString("en-KE")}`;
}

export function whatsappUrl(message: string, whatsappNumber: string = ESSY_LUX_CONFIG.whatsappNumber) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(message: string, whatsappNumber?: string) {
  window.open(whatsappUrl(message, whatsappNumber), "_blank", "noopener,noreferrer");
}

export type CustomerDetails = {
  name: string;
  phone: string;
  location: string;
  note?: string;
};

export type OrderLine = {
  name: string;
  color: string;
  quantity: number;
  price: number;
  productId?: string;
};

type MessageSettings = Partial<
  Pick<StoreSettings, "brand_name" | "tagline" | "currency" | "whatsapp_greeting" | "whatsapp_closing">
>;

const RULE = "━━━━━━━━━━━━━━━━━━━━";

/**
 * Emoji are multi-byte characters that many phones, WhatsApp versions and
 * redirects turn into "�" boxes, which makes an order message look broken.
 * Strip them so the message always reads cleanly, whatever the device.
 */
function plainText(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/(\S) {2,}/g, "$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Renders the admin-configured single-item order template (Settings → WhatsApp)
 * by substituting {{variables}}. A line whose placeholders all come out empty
 * (e.g. "Note: {{note}}" with no note) is dropped instead of left dangling.
 */
export function renderOrderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .split("\n")
    .filter((line) => {
      const keys = [...line.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      return keys.length === 0 || keys.some((k) => (vars[k] ?? "").trim() !== "");
    })
    .join("\n")
    .replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? "");
}

/** Single product order message. */
export function buildSingleOrderMessage(
  line: OrderLine,
  customer: CustomerDetails,
  settings?: MessageSettings & { orderMessageTemplate?: string },
) {
  const currency = settings?.currency ?? ESSY_LUX_CONFIG.currency;
  const total = line.price * line.quantity;
  const brandName = settings?.brand_name ?? ESSY_LUX_CONFIG.brandName;
  const tagline = settings?.tagline ?? ESSY_LUX_CONFIG.tagline;
  const greeting = plainText(settings?.whatsapp_greeting ?? "Hello Essy-Lux,") || "Hello,";
  const closing = plainText(settings?.whatsapp_closing ?? "Thank you for choosing ESSY-LUX.");

  if (settings?.orderMessageTemplate) {
    return plainText(
      renderOrderTemplate(settings.orderMessageTemplate, {
        productName: line.name,
        color: line.color,
        quantity: String(line.quantity),
        price: formatPrice(line.price, currency),
        total: formatPrice(total, currency),
        customerName: customer.name,
        customerPhone: customer.phone,
        location: customer.location,
        note: customer.note?.trim() ?? "",
      }),
    );
  }

  return plainText(
    [
      `*${brandName} — ORDER REQUEST*`,
      RULE,
      "",
      greeting,
      "I would like to place an order:",
      "",
      `*Product:* ${line.name}`,
      `*Color:* ${line.color}`,
      `*Quantity:* ${line.quantity}`,
      `*Price:* ${formatPrice(line.price, currency)}${line.quantity > 1 ? " each" : ""}`,
      "",
      `*TOTAL: ${formatPrice(total, currency)}*`,
      RULE,
      "",
      "*Customer details*",
      `Name: ${customer.name}`,
      `Phone: ${customer.phone}`,
      `Location: ${customer.location}`,
      ...(customer.note?.trim() ? [`Note: ${customer.note.trim()}`] : []),
      "",
      "Please confirm availability, delivery and payment details.",
      "",
      closing,
      `*${brandName}* | ${tagline}`,
    ].join("\n"),
  );
}

/** Multi-item cart order message. */
export function buildCartOrderMessage(lines: OrderLine[], customer: CustomerDetails, settings?: MessageSettings) {
  const currency = settings?.currency ?? ESSY_LUX_CONFIG.currency;
  const brandName = settings?.brand_name ?? ESSY_LUX_CONFIG.brandName;
  const tagline = settings?.tagline ?? ESSY_LUX_CONFIG.tagline;
  const greeting = plainText(settings?.whatsapp_greeting ?? "Hello Essy-Lux,") || "Hello,";
  const closing = plainText(settings?.whatsapp_closing ?? "Thank you for choosing ESSY-LUX.");
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return plainText(
    [
      `*${brandName} — ORDER REQUEST*`,
      RULE,
      "",
      greeting,
      "I would like to place an order:",
      "",
      "*Items*",
      ...lines.flatMap((l, i) => [
        `${i + 1}. *${l.name}*`,
        `    Color: ${l.color}`,
        `    Quantity: ${l.quantity}`,
        `    Price: ${formatPrice(l.price, currency)}${l.quantity > 1 ? " each" : ""}`,
        "",
      ]),
      RULE,
      `Subtotal: ${formatPrice(subtotal, currency)}`,
      "Delivery: To be confirmed",
      `*TOTAL: ${formatPrice(subtotal, currency)}*`,
      RULE,
      "",
      "*Customer details*",
      `Name: ${customer.name}`,
      `Phone: ${customer.phone}`,
      `Location: ${customer.location}`,
      ...(customer.note?.trim() ? [`Note: ${customer.note.trim()}`] : []),
      "",
      "Please confirm availability, delivery details and payment instructions.",
      "",
      closing,
      `*${brandName}* | ${tagline}`,
    ].join("\n"),
  );
}

/** General enquiry message used by the contact page. */
export function buildEnquiryMessage(fields: {
  name: string;
  email?: string;
  phone: string;
  subject: string;
  message: string;
}) {
  return plainText(
    [
      "*ESSY-LUX — ENQUIRY*",
      RULE,
      "",
      "Hello Essy-Lux,",
      "",
      `Name: ${fields.name}`,
      ...(fields.email?.trim() ? [`Email: ${fields.email.trim()}`] : []),
      `Phone: ${fields.phone}`,
      `Subject: ${fields.subject}`,
      "",
      "*Message*",
      fields.message,
      "",
      "Thank you.",
    ].join("\n"),
  );
}