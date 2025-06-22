import { json } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ params }) => {
  const { orderId } = params;

  if (!orderId) {
    return json({ error: "Order ID is missing" }, { status: 400 });
  }

  let shopifyOrderIdAsBigInt;
  try {
    shopifyOrderIdAsBigInt = BigInt(orderId);
  } catch (e) {
    return json({ error: "Invalid Order ID format" }, { status: 400 });
  }

  for (let i = 0; i < 5; i++) {
    const payment = await prisma.pendingPayment.findUnique({
      where: { shopifyOrderId: shopifyOrderIdAsBigInt },
    });

    if (payment) {
      console.log(
        `[API] /get-payment-link/ Found payment link for order ${orderId}.`,
      );
      return json(
        { paymentUrl: payment.monobankPageUrl },
        {
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      );
    }

    if (i < 4) {
      console.log(
        `[API] /get-payment-link/ Payment link for order ${orderId} not found. Retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.warn(
    `[API] /get-payment-link/ Payment link not found for order ${orderId} after all retries.`,
  );
  return json(
    { error: "Payment link not found" },
    {
      status: 404,
      headers: { "Access-Control-Allow-Origin": "*" },
    },
  );
};
