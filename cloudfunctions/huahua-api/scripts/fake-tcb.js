/**
 * @cloudbase/node-sdk 的内存假实现，仅覆盖本项目用到的接口。
 */

const SYMBOL_CURRENT_ENV = Symbol('SYMBOL_CURRENT_ENV');

class FakeCollection {
  constructor(name, store) {
    this.name = name;
    this.store = store;
    this._filter = null;
    this._limit = 0;
  }

  _clone() {
    const c = new FakeCollection(this.name, this.store);
    c._filter = this._filter;
    c._limit = this._limit;
    return c;
  }

  where(cond) {
    const c = this._clone();
    c._filter = cond;
    return c;
  }

  limit(n) {
    const c = this._clone();
    c._limit = n;
    return c;
  }

  async get() {
    const all = this.store.docs.filter((d) => matches(d, this._filter));
    const out = this._limit > 0 ? all.slice(0, this._limit) : all;
    return { data: out.map((d) => ({ ...d })) };
  }

  doc(id) {
    return {
      update: async (data) => {
        const idx = this.store.docs.findIndex((d) => d._id === id);
        if (idx === -1) return { updated: 0 };
        this.store.docs[idx] = { ...this.store.docs[idx], ...data };
        return { updated: 1 };
      },
      remove: async () => {
        const before = this.store.docs.length;
        this.store.docs = this.store.docs.filter((d) => d._id !== id);
        return { deleted: before - this.store.docs.length };
      },
      get: async () => {
        const d = this.store.docs.find((x) => x._id === id);
        return { data: d ? [{ ...d }] : [] };
      },
    };
  }

  async add(data) {
    const _id = 'mock_' + Math.random().toString(36).slice(2, 10);
    this.store.docs.push({ _id, ...data });
    return { id: _id };
  }
}

function matches(doc, filter) {
  if (!filter) return true;
  for (const k of Object.keys(filter)) {
    if (doc[k] !== filter[k]) return false;
  }
  return true;
}

function init(_opts) {
  const stores = {};
  return {
    database() {
      return {
        collection(name) {
          if (!stores[name]) stores[name] = { docs: [] };
          return new FakeCollection(name, stores[name]);
        },
      };
    },
  };
}

module.exports = { init, SYMBOL_CURRENT_ENV };
