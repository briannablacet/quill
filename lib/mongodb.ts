import { MongoClient, Db } from "mongodb"

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set")
  }
  // Cache the client promise globally in both dev and production. Without
  // this, production opened a brand new MongoClient (and a fresh, uncapped
  // connection pool - the driver defaults to 100) on every single request,
  // never reusing or closing it - a guaranteed way to exhaust Atlas's
  // connection limit under any real traffic (confirmed live 2026-07-19,
  // shared Atlas cluster hit 100% of its connection limit).
  //
  // If the connection attempt fails, clear the cache so the next call
  // retries fresh instead of replaying the same rejected promise forever.
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    }).connect().catch((err) => {
      global._mongoClientPromise = undefined
      throw err
    })
  }
  return global._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db("quill")
}
