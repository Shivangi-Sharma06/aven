import "server-only";

import { randomBytes } from "node:crypto";
import { readJsonFile, resolveDataPath, writeJsonFileAtomic } from "./json-file-store";
import { assertProductionPersistence, dataNamespace, sharedRedis } from "./server-persistence";

export type CliScope = "read_streams" | "submit_session" | "request_withdrawal";

export type CliToken = {
  token: string;
  deviceCode: string;
  walletAddress: string;
  createdAt: string;
  expiresAt: string;
  scopes: CliScope[];
  revokedAt?: string;
};

export type DeviceAuthorization = {
  deviceCode: string;
  status: "pending" | "authorized";
  createdAt: string;
  expiresAt: string;
  walletAddress?: string;
  token?: string;
};

type AuthFile = {
  version: 1;
  devices: DeviceAuthorization[];
  tokens: CliToken[];
};

const storePath = resolveDataPath(process.env.AVEN_CLI_TOKEN_STORE, "./data/cli-tokens.json");
let state: AuthFile | undefined;
let writeQueue: Promise<void> = Promise.resolve();

const deviceKey = (code: string) => `${dataNamespace}:cli-device:${code}`;
const tokenKey = (token: string) => `${dataNamespace}:cli-token:${token}`;

async function hydrateLocal() {
  if (!state) {
    state = await readJsonFile<AuthFile>(storePath, { version: 1, devices: [], tokens: [] });
  }
  return state;
}

async function persistLocal() {
  const value = await hydrateLocal();
  writeQueue = writeQueue.then(() => writeJsonFileAtomic(storePath, value));
  await writeQueue;
}

export async function createDeviceAuthorization() {
  assertProductionPersistence();
  const createdAt = new Date();
  const device: DeviceAuthorization = {
    deviceCode: randomBytes(16).toString("hex"),
    status: "pending",
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 5 * 60_000).toISOString(),
  };
  if (sharedRedis) {
    await sharedRedis.set(deviceKey(device.deviceCode), device, { ex: 5 * 60 });
  } else {
    (await hydrateLocal()).devices.push(device);
    await persistLocal();
  }
  return device;
}

export async function getDeviceAuthorization(deviceCode: string) {
  assertProductionPersistence();
  if (sharedRedis) {
    return (await sharedRedis.get<DeviceAuthorization>(deviceKey(deviceCode))) ?? null;
  }
  return (await hydrateLocal()).devices.find((device) => device.deviceCode === deviceCode) ?? null;
}

export async function authorizeDevice(deviceCode: string, walletAddress: string) {
  assertProductionPersistence();
  const device = await getDeviceAuthorization(deviceCode);
  if (!device) throw new Error("Device authorization was not found.");
  if (Date.parse(device.expiresAt) <= Date.now()) throw new Error("Device authorization has expired.");
  if (device.status === "authorized" && device.token) {
    return getCliToken(device.token);
  }

  const createdAt = new Date();
  const token: CliToken = {
    token: randomBytes(32).toString("hex"),
    deviceCode,
    walletAddress,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 8 * 60 * 60_000).toISOString(),
    scopes: ["read_streams", "submit_session", "request_withdrawal"],
  };
  device.status = "authorized";
  device.walletAddress = walletAddress;
  device.token = token.token;

  if (sharedRedis) {
    const deviceSeconds = Math.max(
      1,
      Math.ceil((Date.parse(device.expiresAt) - Date.now()) / 1_000),
    );
    await Promise.all([
      sharedRedis.set(deviceKey(deviceCode), device, { ex: deviceSeconds }),
      sharedRedis.set(tokenKey(token.token), token, { ex: 8 * 60 * 60 }),
    ]);
  } else {
    const value = await hydrateLocal();
    value.tokens.push(token);
    await persistLocal();
  }
  return token;
}

export async function getCliToken(tokenValue: string) {
  assertProductionPersistence();
  const token = sharedRedis
    ? await sharedRedis.get<CliToken>(tokenKey(tokenValue))
    : (await hydrateLocal()).tokens.find((entry) => entry.token === tokenValue);
  if (!token || token.revokedAt || Date.parse(token.expiresAt) <= Date.now()) return null;
  return token;
}

export async function revokeCliToken(tokenValue: string) {
  assertProductionPersistence();
  const token = await getCliToken(tokenValue);
  if (!token) return false;
  token.revokedAt ??= new Date().toISOString();
  if (sharedRedis) {
    const seconds = Math.max(1, Math.ceil((Date.parse(token.expiresAt) - Date.now()) / 1_000));
    await sharedRedis.set(tokenKey(tokenValue), token, { ex: seconds });
  } else {
    await persistLocal();
  }
  return true;
}
