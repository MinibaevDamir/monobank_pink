// app/routes/webhooks.jsx
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { decrypt } from "../lib/crypto.server.js";

async function createMonobankInvoice(apiToken, order) {
  const MONO_API_URL = 'https://api.monobank.ua/api/merchant/invoice/create';
  const amountInCents = Math.round(parseFloat(order.total_price) * 100);
  const payload = {
    amount: amountInCents,
    ccy: 980, // UAH
    merchantPaymInfo: {
      reference: `shopify_order_${order.id}`,
      destination: `Оплата замовлення ${order.name}`,
    },
    redirectUrl: order.order_status_url,
    webHookUrl: `https://${process.env.SHOPIFY_APP_URL}/api/monobank-webhook`,
  };

  try {
    const response = await fetch(MONO_API_URL, {
      method: 'POST',
      headers: { 'X-Token': apiToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Monobank API Error: ${response.status}`, await response.text());
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to call Monobank API", error);
    return null;
  }
}

export const action = async ({ request }) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) { throw new Response(); }

  switch (topic) {
    case "APP_UNINSTALLED":
      console.log(`Shop ${shop} uninstalled the app.`);
      await prisma.monobankSetting.deleteMany({ where: { shop } });
      await prisma.pendingPayment.deleteMany({ where: { shop } });
      break;

    case "ORDERS_CREATE":
      console.log(`Received new order for shop ${shop}:`, payload.id);
      if (payload.financial_status === 'pending') {
        const settings = await prisma.monobankSetting.findUnique({ where: { shop } });
        if (!settings?.apiToken) {
          console.error(`Monobank token not found for shop ${shop}.`);
          break;
        }
        const decryptedToken = decrypt({ content: settings.apiToken, iv: settings.iv });
        if (!decryptedToken) {
           console.error(`Failed to decrypt token for shop ${shop}.`);
           break;
        }
        const monoResponse = await createMonobankInvoice(decryptedToken, payload);
        if (monoResponse?.invoiceId && monoResponse?.pageUrl) {
          await prisma.pendingPayment.create({
            data: {
              shopifyOrderId: payload.admin_graphql_api_id,
              monobankInvoiceId: monoResponse.invoiceId,
              monobankPageUrl: monoResponse.pageUrl,
              shop: shop,
            }
          });
          console.log(`Created and stored pending payment for order ${payload.id}`);
        }
      }
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response();
};