import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

type DohAnswer = {
  readonly name: string;
  readonly type: number;
  readonly TTL: number;
  readonly data: string;
};

type DohJson = {
  readonly Status: number;
  readonly Answer?: readonly DohAnswer[];
};

export type TenantDnsRecordCheck = {
  readonly recordType: string;
  readonly status: number;
  readonly statusLabel: string;
  readonly answers: readonly {
    readonly name: string;
    readonly data: string;
    readonly ttl: number;
  }[];
};

const DNS_STATUS_LABELS: Record<number, string> = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
  6: "YXDOMAIN",
  7: "YXRRSET",
  8: "NXRRSET",
  9: "NOTAUTH",
  10: "NOTZONE",
};

const DOH_TYPES = ["A", "AAAA", "CNAME"] as const;

function dnsStatusLabel(code: number): string {
  return DNS_STATUS_LABELS[code] ?? `RCODE_${code}`;
}

function normalizeHostname(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  const candidate = t.includes("://") ? t : `http://${t}`;
  let host: string;
  try {
    host = new URL(candidate).hostname;
  } catch {
    return "";
  }
  host = host.replace(/\.$/, "");
  if (!host || host.length > 253) return "";
  return host;
}

@Injectable()
export class TenantDnsService {
  async checkPublicDns(rawHostname: string): Promise<{
    readonly hostname: string;
    readonly resolver: string;
    readonly checks: readonly TenantDnsRecordCheck[];
  }> {
    const hostname = normalizeHostname(rawHostname);
    if (!hostname) {
      throw new BadRequestException(
        "Informe um domínio válido ou salve o domínio da vitrine na loja.",
      );
    }

    const checks = await Promise.all(
      DOH_TYPES.map((recordType) => this.queryDoh(hostname, recordType)),
    );

    return {
      hostname,
      resolver: "Cloudflare DNS (1.1.1.1, DNS JSON)",
      checks,
    };
  }

  private async queryDoh(
    name: string,
    recordType: string,
  ): Promise<TenantDnsRecordCheck> {
    const url = new URL("https://cloudflare-dns.com/dns-query");
    url.searchParams.set("name", name);
    url.searchParams.set("type", recordType);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/dns-json" },
      });
    } catch {
      clearTimeout(timer);
      throw new ServiceUnavailableException(
        "Não foi possível consultar o DNS público (Cloudflare).",
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Consulta DNS retornou HTTP ${res.status}.`,
      );
    }

    const json = (await res.json()) as DohJson;
    const status = typeof json.Status === "number" ? json.Status : 2;
    const answers = (json.Answer ?? []).map((a) => ({
      name: a.name,
      data: a.data,
      ttl: a.TTL,
    }));

    return {
      recordType,
      status,
      statusLabel: dnsStatusLabel(status),
      answers,
    };
  }
}
