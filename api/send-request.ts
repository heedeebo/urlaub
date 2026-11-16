import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleSendRequest } from "./_lib/send";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await handleSendRequest({
    method: req.method ?? "GET",
    body: req.body,
    authorization: (req.headers.authorization as string | undefined) ?? null,
    env: process.env,
  });
  res.status(result.status).json(result.body);
}
