import { MongoClient, Db, GridFSBucket, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "syncsign";

declare global {
  var _mongo: Promise<MongoClient> | undefined;
  var _indexesReady: Promise<void> | undefined;
}

function client(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and add your Atlas connection string.");
  if (!global._mongo) {
    global._mongo = new MongoClient(uri, { maxPoolSize: 10 }).connect();
  }
  return global._mongo;
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db(dbName);
  if (!global._indexesReady) {
    global._indexesReady = Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("envelopes").createIndex({ ownerId: 1, updatedAt: -1 }),
      db.collection("envelopes").createIndex({ "recipients.token": 1 }),
      db.collection("envelopes").createIndex({ completedHash: 1 }),
      db.collection("envelopes").createIndex({ originalHash: 1 }),
      db.collection("envelopes").createIndex({ title: "text" }),
      db.collection("audit").createIndex({ envelopeId: 1, at: 1 }),
      db.collection("templates").createIndex({ ownerId: 1, updatedAt: -1 }),
      db.collection("documents").createIndex({ ownerId: 1, updatedAt: -1 }),
      db.collection("contacts").createIndex({ ownerId: 1, email: 1 }, { unique: true }),
      db.collection("notifications").createIndex({ ownerId: 1, at: -1 }),
      db.collection("envelopes").createIndex({ certificateHash: 1 }),
      db.collection("envelopes").createIndex({ legacyCompletedHash: 1 }),
    ]).then(() => undefined).catch((e) => { console.error("Index creation failed", e); });
  }
  await global._indexesReady;
  return db;
}

export async function bucket(): Promise<GridFSBucket> {
  return new GridFSBucket(await getDb(), { bucketName: "files" });
}

export async function saveFile(buf: Buffer, filename: string, meta: Record<string, unknown> = {}): Promise<ObjectId> {
  const b = await bucket();
  return new Promise((resolve, reject) => {
    const up = b.openUploadStream(filename, { metadata: { contentType: "application/pdf", ...meta } });
    up.on("error", reject);
    up.on("finish", () => resolve(up.id as ObjectId));
    up.end(buf);
  });
}

export async function readFile(id: ObjectId): Promise<Buffer> {
  const b = await bucket();
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    b.openDownloadStream(id)
      .on("data", (c: Buffer) => chunks.push(c))
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function deleteFile(id?: ObjectId | null) {
  if (!id) return;
  try { await (await bucket()).delete(id); } catch { /* already gone */ }
}

export function oid(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
