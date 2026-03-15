import type { Context } from "hono";
import {
  type Address,
  type Hex,
  encodeAbiParameters,
  decodeAbiParameters,
  encodePacked,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { type Env, getClient, registryAddress, REGISTRY_ABI } from "./contract";

// ENS resolver function selectors
const ADDR_SELECTOR = "0x3b3b57de"; // addr(bytes32)
const ADDR_COIN_SELECTOR = "0xf1cb7e06"; // addr(bytes32, uint256)
const TEXT_SELECTOR = "0x59d1d43c"; // text(bytes32, string)
const CONTENTHASH_SELECTOR = "0xbc1c58d1"; // contenthash(bytes32)

/** Parse DNS wire format into labels: \x05alice\x05hazza\x04name\x00 → ["alice","hazza","name"] */
function parseDnsName(data: Uint8Array): string[] {
  const labels: string[] = [];
  let offset = 0;
  while (offset < data.length) {
    const len = data[offset];
    if (len === 0) break;
    offset++;
    labels.push(new TextDecoder().decode(data.slice(offset, offset + len)));
    offset += len;
  }
  return labels;
}

/** CCIP-Read gateway handler — GET /ccip/:sender/:data */
export async function handleCcipRead(c: Context<{ Bindings: Env }>) {
  const sender = c.req.param("sender") as Address;
  let rawData = c.req.param("data");

  // Strip .json suffix (URL template: {sender}/{data}.json)
  if (rawData.endsWith(".json")) {
    rawData = rawData.slice(0, -5);
  }
  const data = rawData as Hex;

  try {
    // data = abi.encodeWithSelector(resolve.selector, dnsName, innerData)
    // Skip 4-byte selector → "0x" (2) + selector (8) = 10 chars
    const [dnsNameBytes, innerData] = decodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes" }],
      `0x${(data as string).slice(10)}` as Hex,
    );

    // Parse DNS name → extract first label as HAZZA name
    const labels = parseDnsName(toBytes(dnsNameBytes as Hex));
    if (labels.length < 2) {
      return ccipError(c, "Invalid DNS name: too few labels", 400);
    }
    // Verify this is a hazza.name query
    const tld = labels[labels.length - 1]?.toLowerCase();
    const sld = labels[labels.length - 2]?.toLowerCase();
    if (sld !== "hazza" || tld !== "name") {
      return ccipError(c, "Invalid DNS name: not a hazza.name domain", 400);
    }
    // Join all labels before "hazza.name" to form the hazza name
    // e.g., ["alice", "hazza", "name"] → "alice"
    // e.g., ["sub", "alice", "hazza", "name"] → "sub.alice"
    const nameLabels = labels.slice(0, labels.length - 2).map(l => l.toLowerCase());
    const hazzaName = nameLabels.join(".");
    // Detect subnames: "sub.alice" → namespace="alice", subname="sub"
    const isSubname = nameLabels.length > 1;
    const namespace = isSubname ? nameLabels[nameLabels.length - 1] : "";
    const subname = isSubname ? nameLabels.slice(0, nameLabels.length - 1).join(".") : "";

    // Decode inner resolver call by selector
    const innerHex = innerData as string;
    const selector = innerHex.slice(0, 10);
    const innerParams = `0x${innerHex.slice(10)}` as Hex;

    const client = getClient(c.env);
    const addr = registryAddress(c.env);
    let result: Hex;

    // Helper: resolve owner address for both top-level names and subnames
    async function resolveOwner(): Promise<Address> {
      if (isSubname) {
        const [subnameOwner] = await client.readContract({
          address: addr,
          abi: REGISTRY_ABI,
          functionName: "resolveSubname",
          args: [namespace, subname],
        });
        return subnameOwner as Address;
      }
      const [nameOwner] = await client.readContract({
        address: addr,
        abi: REGISTRY_ABI,
        functionName: "resolve",
        args: [hazzaName],
      });
      return nameOwner as Address;
    }

    switch (selector) {
      case ADDR_SELECTOR: {
        // addr(bytes32) → return owner address
        const nameOwner = await resolveOwner();
        result = encodeAbiParameters(
          [{ type: "address" }],
          [nameOwner as Address],
        );
        break;
      }

      case ADDR_COIN_SELECTOR: {
        // addr(bytes32, uint256) → multichain address as bytes
        const [, coinType] = decodeAbiParameters(
          [{ type: "bytes32" }, { type: "uint256" }],
          innerParams,
        );
        // coinType 60 = ETH, 2147492101 = Base (0x80000000 + 8453)
        if (coinType === 60n || coinType === 2147492101n) {
          const nameOwner = await resolveOwner();
          // Return 20-byte address as bytes (EIP-2304)
          result = encodeAbiParameters(
            [{ type: "bytes" }],
            [nameOwner as Hex],
          );
        } else {
          // Unsupported coin type — return empty bytes
          result = encodeAbiParameters(
            [{ type: "bytes" }],
            ["0x" as Hex],
          );
        }
        break;
      }

      case TEXT_SELECTOR: {
        // text(bytes32, string) → text record value
        // Decode the text key from inner calldata: abi.encode(bytes32 node, string key)
        const [, textKey] = decodeAbiParameters(
          [{ type: "bytes32" }, { type: "string" }],
          innerParams,
        );
        const textValue = await client.readContract({
          address: addr,
          abi: REGISTRY_ABI,
          functionName: "text",
          args: [hazzaName, textKey as string],
        });
        result = encodeAbiParameters(
          [{ type: "string" }],
          [(textValue as string) || ""],
        );
        break;
      }

      case CONTENTHASH_SELECTOR: {
        // contenthash(bytes32) → content hash bytes
        const chash = await client.readContract({
          address: addr,
          abi: REGISTRY_ABI,
          functionName: "contenthash",
          args: [hazzaName],
        });
        result = encodeAbiParameters(
          [{ type: "bytes" }],
          [(chash as `0x${string}`) || "0x"],
        );
        break;
      }

      default:
        return ccipError(c, `Unsupported resolver function: ${selector}`, 400);
    }

    // Sign response — expires in 5 minutes
    const expires = BigInt(Math.floor(Date.now() / 1000) + 300);

    // Hash matching OffchainResolver.makeSignatureHash:
    // keccak256(abi.encodePacked(hex"1900", target, expires, keccak256(request), keccak256(result)))
    const messageHash = keccak256(
      encodePacked(
        ["bytes2", "address", "uint64", "bytes32", "bytes32"],
        [
          "0x1900" as Hex,
          sender,
          expires,
          keccak256(data),
          keccak256(result),
        ],
      ),
    );

    // Raw ECDSA sign (NOT signMessage — no personal_sign prefix)
    const account = privateKeyToAccount(c.env.GATEWAY_SIGNER_KEY as Hex);
    const signature = await account.sign({ hash: messageHash });

    // Encode: abi.encode(bytes result, uint64 expires, bytes signature)
    const responseData = encodeAbiParameters(
      [{ type: "bytes" }, { type: "uint64" }, { type: "bytes" }],
      [result, expires, signature],
    );

    return new Response(JSON.stringify({ data: responseData }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    return ccipError(c, e?.message || "CCIP gateway error", 500);
  }
}

/** CORS preflight handler for CCIP routes */
export function handleCcipOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function ccipError(c: Context, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
