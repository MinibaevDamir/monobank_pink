// app/routes/webhooks.jsx
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { decrypt } from "../lib/crypto.server.js";

async function createMonobankInvoice(apiToken, order) {
  const MONO_API_URL = "https://api.monobank.ua/api/merchant/invoice/create";
  const amountInCents = Math.round(parseFloat(order.total_price) * 100);
  const basketOrder = order.line_items.map((item) => {
    return {
      name: item.title,
      qty: item.quantity,
      sum: Math.round(parseFloat(item.price) * 100),
      code: item.sku || item.variant_id.toString(),
      icon: item.image_url,
      unit: "шт",
    };
  });
  const payload = {
    amount: amountInCents,
    ccy: 980,
    merchantPaymInfo: {
      reference: `shopify_order_${order.id}`,
      destination: `Оплата замовлення ${order.name}`,
      basketOrder: basketOrder,
    },
    redirectUrl: order.order_status_url,
    webHookUrl: `${process.env.SHOPIFY_APP_URL}/api/monobank-webhook`,
  };
  try {
    console.log(
      "[Monobank Request] Sending payload:",
      JSON.stringify(payload, null, 2),
    );
    const response = await fetch(MONO_API_URL, {
      method: "POST",
      headers: { "X-Token": apiToken, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(
        `Monobank API Error: ${response.status}`,
        await response.text(),
      );
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to call Monobank API", error);
    return null;
  }
}

export const action = async ({ request }) => {
  console.log("\n--- [WEBHOOK] Received a request ---");
  let webhookData;
  try {
    webhookData = await authenticate.webhook(request);
  } catch (error) {
    console.error(
      "!!! [WEBHOOK] ERROR during webhook authentication:",
      error.message,
    );
    return new Response("Webhook Authentication Error", { status: 401 });
  }
  const { topic, shop, admin, payload } = webhookData;
  console.log(
    `[WEBHOOK] Authentication successful. Topic: "${topic}", Shop: "${shop}"`,
  );
  if (!admin) {
    console.error(
      "[WEBHOOK] Authentication successful, but admin context is missing.",
    );
    return new Response("Admin context missing", { status: 500 });
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      console.log(`[WEBHOOK] Handling 'app/uninstalled' for shop ${shop}.`);
      await prisma.monobankSetting.deleteMany({ where: { shop } });
      await prisma.pendingPayment.deleteMany({ where: { shop } });
      break;

    case "ORDERS_CREATE":
      const settings = await prisma.monobankSetting.findUnique({
        where: { shop },
      });

      if (settings?.activationStatus !== "active") {
        console.log(`[Webhook] App not active for shop ${shop}. Skipping.`);
        break;
      }
      console.log(
        `[WEBHOOK] Handling 'orders/create' for shop ${shop}. Order ID: ${payload.id}`,
      );

      if (payload.financial_status === "pending") {
        const targetGatewayName = settings?.gatewayName;
        if (!targetGatewayName) {
          console.log(
            `Gateway name not configured for shop ${shop}. Skipping.`,
          );
          break;
        }

        if (
          !payload.payment_gateway_names ||
          payload.payment_gateway_names[0] !== targetGatewayName
        ) {
          console.log(
            `Gateway name is different on order for shop ${shop}. Skipping.`,
          );
          break;
        }
        if (!settings?.apiToken) {
          console.error(`[WEBHOOK] Monobank token not found for shop ${shop}.`);
          break;
        }
        const decryptedToken = decrypt({
          content: settings.apiToken,
          iv: settings.iv,
        });
        if (!decryptedToken) {
          console.error(`[WEBHOOK] Failed to decrypt token for shop ${shop}.`);
          break;
        }
        const monoResponse = await createMonobankInvoice(
          decryptedToken,
          payload,
        );
        if (monoResponse?.invoiceId && monoResponse?.pageUrl) {
          const existingPayment = await prisma.pendingPayment.findUnique({
            where: { shopifyOrderId: payload.id },
          });
          if (!existingPayment) {
            await prisma.pendingPayment.create({
              data: {
                shopifyOrderId: payload.id,
                monobankInvoiceId: monoResponse.invoiceId,
                monobankPageUrl: monoResponse.pageUrl,
                shop: shop,
                amount: payload.total_price,
              },
            });
            console.log(
              `Created and stored pending payment for order ${payload.id}`,
            );
          } else {
            console.log(
              `Pending payment for order ${payload.id} already exists. Skipping.`,
            );
          }
        }
      }
      break;

    default:
      console.warn(`[WEBHOOK] Unhandled webhook topic received: "${topic}"`);
      break;
  }

  console.log("[WEBHOOK] Action finished successfully.");
  return new Response();
};
