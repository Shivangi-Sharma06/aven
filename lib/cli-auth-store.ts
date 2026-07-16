import { randomBytes } from "node:crypto";
import { readJsonFile, resolveDataPath, writeJsonFileAtomic } from "./json-file-store";

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

async function hydrate() {
  if (!state) {
    state = await readJsonFile<AuthFile>(storePath, { version: 1, devices: [], tokens: [] });
  }
  return state;
}

async function persist() {
  const value = await hydrate();
  writeQueue = writeQueue.then(() => writeJsonFileAtomic(storePath, value));
  await writeQueue;
}

export async function createDeviceAuthorization() {
  const value = await hydrate();
  const createdAt = new Date();
  const device: DeviceAuthorization = {
    deviceCode: randomBytes(16).toString("hex"),
    status: "pending",
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 5 * 60_000).toISOString(),
  };
  value.devices.push(device);
  await persist();
  return device;
}

export async function getDeviceAuthorization(deviceCode: string) {
  return (await hydrate()).devices.find((device) => device.deviceCode === deviceCode) ?? null;
}

export async function authorizeDevice(deviceCode: string, walletAddress: string) {
  const value = await hydrate();
  const device = value.devices.find((entry) => entry.deviceCode === deviceCode);
  if (!device) throw new Error("Device authorization was not found.");
  if (Date.parse(device.expiresAt) <= Date.now()) throw new Error("Device authorization has expired.");
  if (device.status === "authorized" && device.token) {
    return value.tokens.find((token) => token.token === device.token) ?? null;
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
  value.tokens.push(token);
  await persist();
  return token;
}

export async function getCliToken(tokenValue: string) {
  const token = (await hydrate()).tokens.find((entry) => entry.token === tokenValue);
  if (!token || token.revokedAt || Date.parse(token.expiresAt) <= Date.now()) return null;
  return token;
}

export async function revokeCliToken(tokenValue: string) {
  const token = (await hydrate()).tokens.find((entry) => entry.token === tokenValue);
  if (!token) return false;
  token.revokedAt ??= new Date().toISOString();
  await persist();
  return true;
}
