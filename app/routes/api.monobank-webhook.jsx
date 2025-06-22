import { json } from "@remix-run/node";
import prisma from "../db.server";
import shopify from "../shopify.server";

const SHOPIFY_API_VERSION = "2025-04";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const payload = await request.json();
  const { invoiceId, status } = payload;

  console.log(
    `[Monobank Webhook] Received status "${status}" for invoice "${invoiceId}"`,
  );

  if (status === "success") {
    const payment = await prisma.pendingPayment.findUnique({
      where: { monobankInvoiceId: invoiceId },
    });

    if (!payment) {
      console.warn(`[Monobank Webhook] Pending payment not found.`);
      return new Response("Payment not found", { status: 404 });
    }

    try {
      const sessionId = `offline_${payment.shop}`;
      const session = await shopify.sessionStorage.loadSession(sessionId);

      if (!session) {
        console.error(`[Monobank Webhook] Could not find session for shop.`);
        return new Response("Session not found", { status: 200 });
      }

      const settings = await prisma.monobankSetting.findUnique({
        where: { shop: payment.shop },
      });

      const gatewayName = settings?.gatewayName || "Monobank Payment";

      const apiUrl = `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/orders/${payment.shopifyOrderId}/transactions.json`;

      const transactionPayload = {
        transaction: {
          amount: payment.amount,
          kind: "sale",
          gateway: gatewayName,
          source: "external",
          status: "success",
        },
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify(transactionPayload),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Failed to create transaction via REST API:", errorBody);
        throw new Error("Shopify REST API call failed.");
      }

      const responseData = await response.json();
      console.log("[Shopify REST Response]", responseData);

      console.log(
        `Successfully created transaction for order ${payment.shopifyOrderId}. Status should now be Paid.`,
      );
      await prisma.pendingPayment.delete({
        where: { monobankInvoiceId: invoiceId },
      });
    } catch (error) {
      console.error("Critical error while updating Shopify order:", error);
      return new Response("Failed to update Shopify order", { status: 500 });
    }
  }

  return new Response("Webhook processed", { status: 200 });
};
