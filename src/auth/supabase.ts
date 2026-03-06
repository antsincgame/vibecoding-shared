import { Client, Databases, Account, Query, ID } from 'appwrite';

let client: Client | null = null;
let databases: Databases | null = null;
let account: Account | null = null;
const DB_ID = 'vibecoding';

function getClient(): Client {
  if (client) return client;
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
  const project = import.meta.env.VITE_APPWRITE_PROJECT_ID || import.meta.env.VITE_APPWRITE_PROJECT;
  if (!endpoint || !project) throw new Error('Missing VITE_APPWRITE_ENDPOINT or VITE_APPWRITE_PROJECT');
  client = new Client().setEndpoint(endpoint).setProject(project);
  return client;
}

function getDatabases(): Databases {
  if (databases) return databases;
  databases = new Databases(getClient());
  return databases;
}

export function getAccount(): Account {
  if (account) return account;
  account = new Account(getClient());
  return account;
}

interface SupabaseResponse<T = any> {
  data: T | null;
  error: any | null;
  count?: number | null;
}

class AppwriteQueryBuilder {
  private collection: string;
  private queries: any[] = [];
  private _countOnly = false;
  private _single = false;
  private _maybeSingle = false;
  private _insertData: any = null;
  private _updateData: any = null;
  private _deleteMode = false;
  private _upsertData: any = null;
  private _upsertConflict: string = 'id';

  constructor(collection: string) { this.collection = collection; }

  select(_columns?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count === 'exact' && opts?.head) this._countOnly = true;
    return this;
  }

  insert(data: any) { this._insertData = Array.isArray(data) ? data : [data]; return this; }
  update(data: any) { this._updateData = data; return this; }
  upsert(data: any, opts?: { onConflict?: string }) { this._upsertData = Array.isArray(data) ? data : [data]; this._upsertConflict = opts?.onConflict || 'id'; return this; }
  delete() { this._deleteMode = true; return this; }

  eq(field: string, value: any) { this.queries.push({ type: 'eq', field, value }); return this; }
  neq(field: string, value: any) { this.queries.push({ type: 'neq', field, value }); return this; }
  gt(field: string, value: any) { this.queries.push({ type: 'gt', field, value }); return this; }
  gte(field: string, value: any) { this.queries.push({ type: 'gte', field, value }); return this; }
  lt(field: string, value: any) { this.queries.push({ type: 'lt', field, value }); return this; }
  lte(field: string, value: any) { this.queries.push({ type: 'lte', field, value }); return this; }
  in(field: string, values: any[]) { this.queries.push({ type: 'in', field, values }); return this; }
  like(field: string, pattern: string) { this.queries.push({ type: 'like', field, value: pattern }); return this; }
  ilike(field: string, pattern: string) { this.queries.push({ type: 'search', field, value: pattern.replace(/%/g, '') }); return this; }
  contains(field: string, value: any) { this.queries.push({ type: 'contains', field, value }); return this; }
  is(field: string, value: any) { if (value === null) this.queries.push({ type: 'isNull', field }); return this; }
  not(field: string, operator: string, value: any) { if (operator === 'is' && value === null) this.queries.push({ type: 'isNotNull', field }); return this; }
  or(_c: string) { return this; }

  order(field: string, opts?: { ascending?: boolean }) {
    this.queries.push({ type: 'order', field, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number) { this.queries.push({ type: 'limit', value: n }); return this; }

  range(from: number, to: number) {
    this.queries.push({ type: 'limit', value: to - from + 1 });
    this.queries.push({ type: 'offset', value: from });
    return this;
  }

  single(): Promise<SupabaseResponse> { this._single = true; return this.execute(); }
  maybeSingle(): Promise<SupabaseResponse> { this._maybeSingle = true; return this.execute(); }

  private buildQueries(): string[] {
    const aq: string[] = [];
    for (const q of this.queries) {
      const f = q.field === 'id' ? '$id' : q.field;
      switch (q.type) {
        case 'eq': aq.push(Query.equal(f, q.value)); break;
        case 'neq': aq.push(Query.notEqual(f, q.value)); break;
        case 'gt': aq.push(Query.greaterThan(f, q.value)); break;
        case 'gte': aq.push(Query.greaterThanEqual(f, q.value)); break;
        case 'lt': aq.push(Query.lessThan(f, q.value)); break;
        case 'lte': aq.push(Query.lessThanEqual(f, q.value)); break;
        case 'in': aq.push(Query.equal(f, q.values)); break;
        case 'contains': case 'search': case 'like':
          aq.push(Query.search(f, String(q.value).replace(/%/g, ''))); break;
        case 'isNull': aq.push(Query.isNull(f)); break;
        case 'isNotNull': aq.push(Query.isNotNull(f)); break;
        case 'order': aq.push(q.asc ? Query.orderAsc(q.field) : Query.orderDesc(q.field)); break;
        case 'limit': aq.push(Query.limit(q.value)); break;
        case 'offset': aq.push(Query.offset(q.value)); break;
      }
    }
    return aq;
  }

  private getEqFilters() { return this.queries.filter(q => q.type === 'eq'); }

  private docToRow(doc: any): any {
    const row: any = { id: doc.$id };
    for (const [k, v] of Object.entries(doc)) {
      if (k.startsWith("$")) continue;
      if (typeof v === "string" && v.length > 1) {
        const c0 = v.charAt(0), cL = v.charAt(v.length - 1);
        if ((c0 === "[" && cL === "]") || (c0 === "{" && cL === "}")) {
          try { row[k] = JSON.parse(v); continue; } catch (e) {}
        }
      }
      row[k] = v;
    }
    return row;
  }

  private async execute(): Promise<SupabaseResponse> {
    try {
      const db = getDatabases();

      if (this._insertData) {
        const results = [];
        for (const item of this._insertData) {
          const docId = item.id || ID.unique();
          const clean: any = {};
          for (const [k, v] of Object.entries(item)) {
            if (k === 'id' || v === undefined) continue;
            clean[k] = Array.isArray(v) ? JSON.stringify(v) : v;
          }
          const doc = await db.createDocument(DB_ID, this.collection, docId, clean);
          results.push(this.docToRow(doc));
        }
        return { data: results.length === 1 ? results[0] : results, error: null };
      }

      if (this._upsertData) {
        const results = [];
        for (const item of this._upsertData) {
          const clean: any = {};
          for (const [k, v] of Object.entries(item)) {
            if (k === 'id' || v === undefined) continue;
            clean[k] = Array.isArray(v) ? JSON.stringify(v) : v;
          }
          try {
            // Try to find existing doc by conflict field
            const conflictField = this._upsertConflict;
            const conflictValue = item[conflictField];
            if (conflictField !== 'id' && conflictValue) {
              const existing = await db.listDocuments(DB_ID, this.collection, [Query.equal(conflictField, conflictValue), Query.limit(1)]);
              if (existing.documents.length > 0) {
                const doc = await db.updateDocument(DB_ID, this.collection, existing.documents[0].$id, clean);
                results.push(this.docToRow(doc));
                continue;
              }
            }
            // Try update by id
            const docId = item.id || ID.unique();
            try {
              const doc = await db.updateDocument(DB_ID, this.collection, docId, clean);
              results.push(this.docToRow(doc));
            } catch {
              const doc = await db.createDocument(DB_ID, this.collection, docId, clean);
              results.push(this.docToRow(doc));
            }
          } catch (e: any) {
            return { data: null, error: { message: e.message, code: e.code } };
          }
        }
        return { data: results.length === 1 ? results[0] : results, error: null };
      }

      if (this._deleteMode) {
        const eqs = this.getEqFilters();
        if (eqs.length > 0 && eqs[0].field === 'id') {
          await db.deleteDocument(DB_ID, this.collection, eqs[0].value);
        } else if (eqs.length > 0) {
          const awQ = eqs.map(e => Query.equal(e.field === 'id' ? '$id' : e.field, e.value));
          const { documents } = await db.listDocuments(DB_ID, this.collection, awQ);
          for (const doc of documents) await db.deleteDocument(DB_ID, this.collection, doc.$id);
        }
        return { data: null, error: null };
      }

      if (this._updateData) {
        const eqs = this.getEqFilters();
        const clean: any = {};
        for (const [k, v] of Object.entries(this._updateData)) {
          if (k === 'id' || v === undefined) continue;
          clean[k] = Array.isArray(v) ? JSON.stringify(v) : v;
        }
        if (eqs.length > 0 && eqs[0].field === 'id') {
          const doc = await db.updateDocument(DB_ID, this.collection, eqs[0].value, clean);
          return { data: this.docToRow(doc), error: null };
        } else if (eqs.length > 0) {
          const awQ = eqs.map(e => Query.equal(e.field === 'id' ? '$id' : e.field, e.value));
          const { documents } = await db.listDocuments(DB_ID, this.collection, awQ);
          const results = [];
          for (const doc of documents) {
            const updated = await db.updateDocument(DB_ID, this.collection, doc.$id, clean);
            results.push(this.docToRow(updated));
          }
          return { data: results, error: null };
        }
        return { data: null, error: null };
      }

      if (this._countOnly) {
        const awQ = this.buildQueries().filter(q => !q.includes('order'));
        awQ.push(Query.limit(1));
        const result = await db.listDocuments(DB_ID, this.collection, awQ);
        return { data: null, error: null, count: result.total };
      }

      const awQ = this.buildQueries();
      if (!awQ.some(q => q.includes('limit'))) awQ.push(Query.limit(100));
      const result = await db.listDocuments(DB_ID, this.collection, awQ);
      const rows = result.documents.map((d: any) => this.docToRow(d));

      if (this._single) {
        return rows.length === 0
          ? { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          : { data: rows[0], error: null };
      }
      if (this._maybeSingle) return { data: rows[0] || null, error: null };
      return { data: rows, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message, code: error.code } };
    }
  }

  then(resolve?: (v: SupabaseResponse) => any, reject?: (e: any) => any): Promise<any> {
    return this.execute().then(resolve, reject);
  }
  catch(fn: (e: any) => any) { return this.execute().catch(fn); }
}

type AuthListener = (event: string, session: any) => void;
const authListeners: AuthListener[] = [];
let currentSession: any = null;

async function getSessionFromAccount(): Promise<any> {
  try {
    const acc = getAccount();
    const user = await acc.get();
    currentSession = {
      user: { id: user.$id, email: user.email, user_metadata: { full_name: user.name } },
      access_token: 'appwrite-session',
      refresh_token: 'appwrite-session',
    };
    return currentSession;
  } catch { currentSession = null; return null; }
}

function notifyAuthListeners(event: string) {
  for (const fn of authListeners) fn(event, currentSession);
}

const authCompat = {
  getSession: async () => ({ data: { session: await getSessionFromAccount() }, error: null }),
  getUser: async () => {
    const s = await getSessionFromAccount();
    return { data: { user: s?.user || null }, error: null };
  },
  onAuthStateChange: (callback: AuthListener) => {
    authListeners.push(callback);
    getSessionFromAccount().then(() => callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession));
    return { data: { subscription: { unsubscribe: () => {
      const i = authListeners.indexOf(callback); if (i >= 0) authListeners.splice(i, 1);
    }}}};
  },
  signUp: async ({ email, password, options }: any) => {
    try {
      const acc = getAccount();
      await acc.create(ID.unique(), email, password, options?.data?.full_name || '');
      await acc.createEmailPasswordSession(email, password);
      await getSessionFromAccount();
      notifyAuthListeners('SIGNED_IN');
      return { data: { user: currentSession?.user }, error: null };
    } catch (e: any) { return { data: null, error: { message: e.message, code: e.code } }; }
  },
  signInWithPassword: async ({ email, password }: any) => {
    try {
      const acc = getAccount();
      await acc.createEmailPasswordSession(email, password);
      await getSessionFromAccount();
      notifyAuthListeners('SIGNED_IN');
      return { error: null };
    } catch (e: any) { return { error: { message: e.message, code: e.code } }; }
  },
  signInWithOAuth: async ({ provider, options }: any) => {
    try {
      if (provider === 'google') {
        const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
        const project = import.meta.env.VITE_APPWRITE_PROJECT_ID || import.meta.env.VITE_APPWRITE_PROJECT;
        const success = encodeURIComponent(options?.redirectTo || window.location.origin + '/auth/callback');
        const failure = encodeURIComponent(window.location.origin + '/login');
        const scopes = encodeURIComponent('openid email profile');
        window.location.href = endpoint + '/account/sessions/oauth2/google?project=' + project + '&success=' + success + '&failure=' + failure;
      }
      return { data: {}, error: null };
    } catch (e: any) { return { data: null, error: { message: e.message, code: e.code } }; }
  },
  signOut: async () => {
    try { const acc = getAccount(); await acc.deleteSession('current'); } catch {}
    currentSession = null;
    notifyAuthListeners('SIGNED_OUT');
  },
  refreshSession: async () => {
    const s = await getSessionFromAccount();
    return { data: { session: s }, error: s ? null : { message: 'No session' } };
  },
  admin: { listUsers: async () => ({ data: { users: [] }, error: { message: 'Not available' } }) },
};

const storageCompat = {
  from: () => ({
    upload: async () => ({ data: null, error: { message: 'Use Appwrite Storage' } }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
    remove: async () => ({ data: null, error: null }),
    list: async () => ({ data: [], error: null }),
  }),
  listBuckets: async () => ({ data: [], error: null }),
};

interface SupabaseCompat {
  from: (table: string) => AppwriteQueryBuilder;
  auth: typeof authCompat;
  storage: typeof storageCompat;
  rpc: (fn: string, params?: any) => Promise<SupabaseResponse>;
}

let instance: SupabaseCompat | null = null;

export function getSupabase(): SupabaseCompat {
  if (instance) return instance;
  instance = {
    from: (table: string) => new AppwriteQueryBuilder(table),
    auth: authCompat,
    storage: storageCompat,
    rpc: async () => ({ data: null, error: { message: 'Use Appwrite Functions' } }),
  };
  return instance;
}

export async function restoreCrossDomainSession(): Promise<boolean> {
  return !!(await getSessionFromAccount());
}

export type SupabaseClient = SupabaseCompat;
