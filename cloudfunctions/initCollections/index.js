const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTIONS = ['playerData'];

exports.main = async () => {
  const db = cloud.database();
  const created = [];
  const existed = [];
  const errors = [];

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      created.push(name);
    } catch (e) {
      const message = e?.message || e?.errMsg || String(e);
      if (
        e?.errCode === -501001
        || e?.errCode === -501007
        || message.includes('already exist')
        || message.includes('ALREADY_EXIST')
        || message.includes('Table exist')
      ) {
        existed.push(name);
      } else {
        errors.push({ name, error: message });
      }
    }
  }

  return { created, existed, errors };
};
