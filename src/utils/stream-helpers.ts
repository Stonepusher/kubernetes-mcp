import { PassThrough } from 'stream';

export function collectStream(stream: PassThrough, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      stream.destroy();
      resolve(Buffer.concat(chunks).toString('utf-8'));
    }, timeoutMs);

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    stream.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
