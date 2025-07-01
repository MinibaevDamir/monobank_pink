import { json } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Health check failed: Could not connect to the database.",
      error,
    );
    return json(
      {
        status: "error",
        message: "Database connection failed",
      },
      { status: 503 },
    );
  }
};
