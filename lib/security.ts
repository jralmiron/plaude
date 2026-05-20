import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);

  return await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${toBase64Url(salt)}:${toBase64Url(derivedKey)}`);
    });
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltBase64, hashBase64] = storedHash.split(':');
  if (!saltBase64 || !hashBase64) return false;

  const salt = Buffer.from(saltBase64, 'base64url');
  const expected = Buffer.from(hashBase64, 'base64url');

  return await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(crypto.timingSafeEqual(expected, derivedKey));
    });
  });
}
