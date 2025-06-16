// app/routes/api.get-payment-link.$orderId.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ params }) => {
  const { orderId } = params;
  const shopifyOrderIdGid = `gid://shopify/Order/${orderId}`;

  for (let i = 0; i < 3; i++) {
    const payment = await prisma.pendingPayment.findUnique({
      where: { shopifyOrderId: shopifyOrderIdGid },
    });
    if (payment) {
      return json({ paymentUrl: payment.monobankPageUrl }, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    if (i < 2) await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return json({ error: "Payment link not found" }, {
    status: 404,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
};