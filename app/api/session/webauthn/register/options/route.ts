import { registerOptions } from "@/lib/server/webauthn-handlers";

export async function POST(request: Request) {
  return registerOptions(request);
}
