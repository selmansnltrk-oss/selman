import type { Tokens } from "@wix/sdk";
import { Store, digest, random } from "./store.js";
import { entitlement } from "./policy.js";
import type { Provider, OAuthData } from "./wix.js";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
interface Attempt {
  challenge: string;
  oauth?: OAuthData;
  readyToken?: string;
  state?: string;
  started?: boolean;
}
interface Session {
  tokens: Tokens;
  memberId: string;
}
export class MembershipService {
  constructor(
    public store: Store,
    private provider: Provider,
    private origin: string,
    private now = () => Date.now(),
  ) {}
  async bounded<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new HttpError(503, "WIX_UNAVAILABLE")),
            15000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  createAttempt(challenge: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge))
      throw new HttpError(400, "INVALID_CHALLENGE");
    const id = random(),
      expiry = this.now() + 10 * 60_000;
    this.store.put("attempt", id, { challenge } satisfies Attempt, expiry);
    return {
      attemptId: id,
      browserUrl: this.origin + "/auth/start/" + id,
      expiresAt: new Date(expiry).toISOString(),
    };
  }
  async begin(id: string) {
    const record = this.store.get<Attempt>("attempt", id, this.now());
    if (!record || record.value.started)
      throw new HttpError(410, "LOGIN_EXPIRED");
    record.value.started = true;
    this.store.put("attempt", id, record.value, record.expires);
    try {
      const { oauth, url } = await this.bounded(
        this.provider.begin(this.origin + "/auth/callback"),
      );
      this.store.put(
        "attempt",
        id,
        { ...record.value, oauth, state: oauth.state },
        record.expires,
      );
      this.store.put(
        "oauth",
        digest(oauth.state),
        { attemptId: id },
        record.expires,
      );
      return url;
    } catch {
      this.store.remove("attempt", id);
      throw new HttpError(503, "WIX_UNAVAILABLE");
    }
  }
  async callback(code: string, state: string) {
    const flow = this.store.take<{ attemptId: string }>("oauth", digest(state));
    if (!flow) throw new HttpError(400, "INVALID_OAUTH_STATE");
    const attempt = this.store.get<Attempt>(
      "attempt",
      flow.value.attemptId,
      this.now(),
    );
    if (!attempt?.value.oauth || attempt.value.state !== state)
      throw new HttpError(400, "INVALID_OAUTH_STATE");
    try {
      const tokens = await this.bounded(
        this.provider.complete(code, state, attempt.value.oauth),
      );
      const identity = await this.bounded(this.provider.inspect(tokens));
      const token = random();
      this.store.put(
        "session",
        digest(token),
        {
          tokens: identity.tokens,
          memberId: identity.member._id,
        } satisfies Session,
        this.now() + 30 * 24 * 60 * 60_000,
      );
      this.store.put(
        "attempt",
        flow.value.attemptId,
        {
          challenge: attempt.value.challenge,
          readyToken: token,
        } satisfies Attempt,
        attempt.expires,
      );
    } catch {
      this.store.remove("attempt", flow.value.attemptId);
      throw new HttpError(503, "WIX_LOGIN_FAILED");
    }
  }
  exchange(id: string, verifier: string) {
    const a = this.store.get<Attempt>("attempt", id, this.now());
    if (!a) throw new HttpError(410, "LOGIN_EXPIRED");
    if (
      !/^[A-Za-z0-9_-]{43,128}$/.test(verifier) ||
      digest(verifier) !== a.value.challenge
    )
      throw new HttpError(403, "INVALID_DEVICE_PROOF");
    if (!a.value.readyToken) return { pending: true as const };
    const taken = this.store.take<Attempt>("attempt", id);
    if (!taken?.value.readyToken) throw new HttpError(410, "LOGIN_EXPIRED");
    return { pending: false as const, sessionToken: taken.value.readyToken };
  }
  async status(token: string) {
    const key = digest(token),
      s = this.store.get<Session>("session", key, this.now());
    if (!s) throw new HttpError(401, "SESSION_EXPIRED");
    try {
      const current = await this.bounded(this.provider.inspect(s.value.tokens));
      if (current.member._id !== s.value.memberId) {
        this.store.remove("session", key);
        throw new HttpError(401, "IDENTITY_CHANGED");
      }
      if (!this.store.get("session", key, this.now()))
        throw new HttpError(401, "SESSION_EXPIRED");
      this.store.put(
        "session",
        key,
        {
          tokens: current.tokens,
          memberId: current.member._id,
        } satisfies Session,
        s.expires,
      );
      const rejected: Record<string, number> = {};
      const subscription = entitlement(
        current.orders,
        current.member._id,
        this.now(),
        (reason) => {
          rejected[reason] = (rejected[reason] ?? 0) + 1;
        },
      );
      if (!subscription)
        console.info(
          "Membership denied",
          JSON.stringify({ orderCount: current.orders.length, rejected }),
        );
      return {
        member: current.member,
        access: subscription !== null,
        subscription,
        checkedAt: new Date(this.now()).toISOString(),
        leaseUntil: subscription
          ? new Date(
              Math.min(+new Date(subscription.leaseUntil), s.expires),
            ).toISOString()
          : null,
      };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (e instanceof Error && e.message === "MEMBER_REQUIRED") {
        this.store.remove("session", key);
        throw new HttpError(401, "SESSION_EXPIRED");
      }
      throw new HttpError(503, "WIX_UNAVAILABLE");
    }
  }
  logout(token: string) {
    this.store.remove("session", digest(token));
  }
}
