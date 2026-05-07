import { authOptions } from "@/lib/server/webauthn-handlers";

export async function POST(request: Request) {
  return authOptions(request);
}
