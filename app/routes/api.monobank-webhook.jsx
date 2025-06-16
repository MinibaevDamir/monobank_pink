import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const payload = await request.json();
  const { invoiceId, status } = payload;

  console.log(`Received webhook from Monobank for invoice ${invoiceId} with status ${status}`);
  // !!! УВАГА: В реальному додатку тут ОБОВ'ЯЗКОВО має бути перевірка підпису вебхука (`X-Sign`)
  console.warn("Monobank webhook signature validation is not implemented!");

  if (status === "success") {
    const payment = await prisma.pendingPayment.findUnique({
      where: { monobankInvoiceId: invoiceId },
    });
    if (!payment) {
      console.warn(`Pending payment with invoiceId ${invoiceId} not found.`);
      return new Response("Payment not found", { status: 404 });
    }

    try {
      const { admin } = await authenticate.admin(request, { shop: payment.shop });
      const response = await admin.graphql(
        `#graphql
        mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
          orderMarkAsPaid(input: $input) {
            order { id }
            userErrors { field message }
          }
        }`,
        { variables: { input: { id: payment.shopifyOrderId } } }
      );
      
      const { data, errors } = await response.json();
      if (errors || data?.orderMarkAsPaid?.userErrors?.length) {
         console.error("Failed to mark order as paid in Shopify:", errors || data.orderMarkAsPaid.userErrors);
      } else {
         console.log(`Successfully marked order ${payment.shopifyOrderId} as paid.`);
         await prisma.pendingPayment.delete({ where: { monobankInvoiceId: invoiceId } });
      }
    } catch (error) {
      console.error("Error updating Shopify order:", error);
      return new Response("Failed to update Shopify order", { status: 500 });
    }
  }

  return new Response("Webhook processed", { status: 200 });
};