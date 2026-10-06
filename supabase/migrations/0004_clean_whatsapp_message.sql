-- ============================================================
-- Switch the WhatsApp order message to a clean, emoji-free layout.
--
-- Emoji are multi-byte characters that many phones / WhatsApp versions
-- show as "�" boxes, which made order messages look broken. Run this once
-- in Supabase -> SQL Editor if your database was created before this file
-- existed (new databases already get these defaults from 0001_init.sql).
-- ============================================================
update public.settings
set
  whatsapp_greeting = 'Hello Essy-Lux,',
  whatsapp_closing = 'Thank you for choosing ESSY-LUX.',
  order_message_template = E'*ESSY-LUX — ORDER REQUEST*\n━━━━━━━━━━━━━━━━━━━━\n\nHello Essy-Lux,\nI would like to place an order:\n\n*Product:* {{productName}}\n*Color:* {{color}}\n*Quantity:* {{quantity}}\n*Price:* {{price}}\n\n*TOTAL: {{total}}*\n━━━━━━━━━━━━━━━━━━━━\n\n*Customer details*\nName: {{customerName}}\nPhone: {{customerPhone}}\nLocation: {{location}}\nNote: {{note}}\n\nPlease confirm availability, delivery and payment details.\n\nThank you for choosing ESSY-LUX.\n*ESSY-LUX* | LUXURY BAGS'
where id = true;
