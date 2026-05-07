import { registerVerify } from "@/lib/server/webauthn-handlers";

export async function POST(request: Request) {
  return registerVerify(request);
}
