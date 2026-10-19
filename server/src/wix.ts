import { createClient, OAuthStrategy, type Tokens } from "@wix/sdk";
import { members } from "@wix/members";
import { orders } from "@wix/pricing-plans";
import { PLANS, type WixOrder } from "./policy.js";
export type OAuthData = ReturnType<
  ReturnType<typeof OAuthStrategy>["generateOAuthData"]
>;
export interface Identity {
  _id: string;
  name: string;
  email: string;
}
export interface Provider {
  begin(callback: string): Promise<{ oauth: OAuthData; url: string }>;
  complete(code: string, state: string, oauth: OAuthData): Promise<Tokens>;
  inspect(
    tokens: Tokens,
  ): Promise<{ tokens: Tokens; member: Identity; orders: WixOrder[] }>;
}
export class WixProvider implements Provider {
  constructor(private clientId: string) {}
  client(tokens?: Tokens) {
    return createClient({
      modules: { members, orders },
      auth: OAuthStrategy({ clientId: this.clientId, tokens }),
    });
  }
  async begin(callback: string) {
    const client = this.client(),
      oauth = client.auth.generateOAuthData(callback, callback);
    const { authUrl } = await client.auth.getAuthUrl(oauth, {
      responseMode: "query",
      prompt: "login",
    });
    const url = new URL(authUrl);
    if (url.protocol !== "https:") throw Error("Güvensiz Wix yönlendirmesi");
    return { oauth, url: authUrl };
  }
  async complete(code: string, state: string, oauth: OAuthData) {
    return this.client().auth.getMemberTokens(code, state, oauth);
  }
  async inspect(tokens: Tokens) {
    const client = this.client(tokens);
    if (tokens.refreshToken.role !== "member") throw Error("MEMBER_REQUIRED");
    if (tokens.accessToken.expiresAt <= Math.floor(Date.now() / 1000) + 60) {
      tokens = await client.auth.renewToken(tokens.refreshToken);
      client.auth.setTokens(tokens);
    }
    const { member } = await client.members.getCurrentMember({
      fieldsets: ["FULL"],
    });
    if (!member?._id || member.status !== "APPROVED")
      throw Error("MEMBER_REQUIRED");
    const all: WixOrder[] = [];
    for (let offset = 0; offset < 5000; offset += 50) {
      const page = await client.orders.memberListOrders({
        planIds: Object.keys(PLANS),
        limit: 50,
        offset,
      });
      const items = page.orders ?? [];
      all.push(...items);
      if (items.length < 50)
        return {
          tokens: client.auth.getTokens(),
          member: {
            _id: member._id,
            name:
              member.profile?.nickname ||
              [member.contact?.firstName, member.contact?.lastName]
                .filter(Boolean)
                .join(" ") ||
              member.loginEmail ||
              "Üye",
            email: member.loginEmail ?? "",
          },
          orders: all,
        };
    }
    throw Error("ORDER_PAGINATION_LIMIT");
  }
}
