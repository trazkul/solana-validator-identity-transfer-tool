import { Keypair } from "@solana/web3.js";

export type EncryptedPayload = {
  algorithm: "AES-GCM";
  kdf: "PBKDF2";
  iterations: 250000;
  salt: string;
  iv: string;
  ciphertext: string;
};

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function maskPublicKey(publicKey: string) {
  if (publicKey.length <= 12) {
    return publicKey;
  }

  return `${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`;
}

export function validateKeypairArray(input: unknown) {
  if (!Array.isArray(input)) {
    return "Keypair file must contain a JSON array.";
  }

  if (input.length !== 64) {
    return "Keypair file must contain exactly 64 numbers.";
  }

  const isValid = input.every(
    (value) =>
      Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255,
  );

  if (!isValid) {
    return "Each keypair value must be an integer between 0 and 255.";
  }

  return null;
}

export function derivePublicKey(keypairBytes: number[]) {
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
  return keypair.publicKey.toBase58();
}

export function generateDemoKeypair() {
  const demoKeypair = Keypair.generate();

  return {
    secretKey: Array.from(demoKeypair.secretKey),
    publicKey: demoKeypair.publicKey.toBase58(),
  };
}

export async function encryptKeypair(
  keypairBytes: number[],
  passphrase: string,
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256",
    },
    passphraseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt"],
  );

  const payload = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    Uint8Array.from(keypairBytes),
  );

  return {
    algorithm: "AES-GCM",
    kdf: "PBKDF2",
    iterations: 250000,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(payload)),
  };
}
