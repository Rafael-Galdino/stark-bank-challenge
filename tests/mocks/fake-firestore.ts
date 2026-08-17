import { Timestamp } from '@google-cloud/firestore';

/**
 * Fake minimalista do cliente Firestore, usado apenas em testes unitarios
 * de FirestoreEventStoreRepository. Nao faz nenhuma chamada de rede - e um
 * armazenamento em memoria que imita o subconjunto da API do
 * @google-cloud/firestore realmente utilizado pelo repositorio
 * (collection().doc().get/set/update, where().get(), where().count().get()
 * e runTransaction()).
 *
 * `Timestamp` e importado da biblioteca real porque e uma classe de dados
 * pura (sem I/O), entao os testes exercitam exatamente a mesma logica de
 * conversao de datas (`.toDate()`) usada em producao.
 */
type DocData = Record<string, unknown>;

interface FakeDocRef {
  path: string;
  get(): Promise<FakeDocSnapshot>;
  set(data: DocData): Promise<void>;
  update(data: DocData): Promise<void>;
  delete(): Promise<void>;
}

interface FakeDocSnapshot {
  exists: boolean;
  data(): DocData | undefined;
}

export class FakeFirestore {
  readonly store = new Map<string, DocData>();

  collection(name: string) {
    return {
      doc: (id: string): FakeDocRef => this.makeDocRef(`${name}/${id}`),
      where: (field: string, op: string, value: unknown) => this.makeQuery(name, [{ field, op, value }]),
      get: async () => this.makeQuerySnapshot(name, []),
    };
  }

  private makeQuery(collectionName: string, filters: { field: string; op: string; value: unknown }[]) {
    return {
      where: (field: string, op: string, value: unknown) =>
        this.makeQuery(collectionName, [...filters, { field, op, value }]),
      get: async () => this.makeQuerySnapshot(collectionName, filters),
      count: () => ({
        get: async () => {
          const snap = this.makeQuerySnapshot(collectionName, filters);
          return { data: () => ({ count: snap.docs.length }) };
        },
      }),
    };
  }

  private makeQuerySnapshot(collectionName: string, filters: { field: string; op: string; value: unknown }[]) {
    const prefix = `${collectionName}/`;
    const docs = Array.from(this.store.entries())
      .filter(([path]) => path.startsWith(prefix))
      .filter(([, data]) => filters.every((f) => matches(data[f.field], f.op, f.value)))
      .map(([path, data]) => ({ id: path.slice(prefix.length), data: () => data }));
    return { docs, empty: docs.length === 0 };
  }

  private makeDocRef(path: string): FakeDocRef {
    return {
      path,
      get: async () => {
        const data = this.store.get(path);
        return { exists: data !== undefined, data: () => data };
      },
      set: async (data: DocData) => {
        this.store.set(path, data);
      },
      update: async (data: DocData) => {
        const existing = this.store.get(path) ?? {};
        this.store.set(path, { ...existing, ...data });
      },
      delete: async () => {
        this.store.delete(path);
      },
    };
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    return fn(new FakeTransaction(this));
  }
}

class FakeTransaction {
  constructor(private readonly db: FakeFirestore) {}

  async get(ref: FakeDocRef): Promise<FakeDocSnapshot> {
    return ref.get();
  }

  set(ref: FakeDocRef, data: DocData): void {
    this.db.store.set(ref.path, data);
  }

  update(ref: FakeDocRef, data: DocData): void {
    const existing = this.db.store.get(ref.path) ?? {};
    this.db.store.set(ref.path, { ...existing, ...data });
  }
}

function matches(fieldValue: unknown, op: string, target: unknown): boolean {
  if (op === '==') return fieldValue === target;
  if (op === '<') {
    if (fieldValue instanceof Timestamp && target instanceof Timestamp) {
      return fieldValue.toMillis() < target.toMillis();
    }
    return (fieldValue as number) < (target as number);
  }
  throw new Error(`Operador nao suportado no fake: ${op}`);
}
