const crypto = require('crypto');
const { collection } = require('./db');
const { requireUser } = require('./auth');
const { respond } = require('./http');
const { getWechatPushTokens } = require('./config');

const SUCCESS = { ErrCode: 0, ErrMsg: 'Success' };
const PENDING_GIFT_COLLECTION = 'pendingWechatGifts';

async function handleWechatPushVerify(req) {
  const qs = req.query || {};
  const { signature, timestamp, nonce, echostr } = qs;
  if (!checkSignature(signature, timestamp, nonce)) {
    return respond(403, 'signature mismatch', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  return respond(200, echostr || '', { 'Content-Type': 'text/plain; charset=utf-8' });
}

async function handleWechatPushCallback(req) {
  const qs = req.query || {};
  if (!checkSignature(qs.signature, qs.timestamp, qs.nonce)) {
    return respond(403, { ErrCode: -1, ErrMsg: 'signature mismatch' });
  }

  let msg;
  try {
    msg = parsePostBody(readRawBody(req));
  } catch (error) {
    console.error('[wechatPush] parse failed:', error && error.message ? error.message : error);
    return respond(200, { ErrCode: -1, ErrMsg: 'Parse error' });
  }

  if (!msg || Object.keys(msg).length === 0) {
    return respond(200, { ErrCode: -1, ErrMsg: 'Empty message' });
  }

  const now = Date.now();
  const eventName = String(msg.Event || msg.event || '');
  await recordPushMessage(msg, eventName, now);

  if (msg.MsgType === 'event' && eventName === 'minigame_deliver_goods') {
    await recordDeliverGoods(msg.MiniGame || {}, msg, now);
  } else if (msg.MsgType === 'event' && eventName === 'minigame_notify_msg') {
    console.log('[wechatPush] notify:', msg.Title || '', msg.Content || '');
  } else {
    console.log('[wechatPush] ignored event:', msg.MsgType || '', eventName || '');
  }

  return respond(200, SUCCESS);
}

async function handleQueryPendingWechatGifts(req) {
  const user = requireUser(req);
  const res = await collection(PENDING_GIFT_COLLECTION)
    .where({ userId: user.userId, status: 'pending' })
    .orderBy('createdAt', 'asc')
    .limit(20)
    .get();
  return { gifts: normalizeGiftRows((res && res.data) || []) };
}

async function handleMarkWechatGiftsGranted(req) {
  const user = requireUser(req);
  const body = req.body || {};
  const ids = Array.isArray(body.ids) ? body.ids.map(v => String(v || '')).filter(Boolean) : [];
  if (ids.length === 0) return { updated: 0 };

  let updated = 0;
  const col = collection(PENDING_GIFT_COLLECTION);
  for (const id of ids) {
    try {
      const docRes = await col.doc(id).get();
      const doc = docRes && docRes.data && (Array.isArray(docRes.data) ? docRes.data[0] : docRes.data);
      if (!doc || doc.userId !== user.userId || doc.status !== 'pending') continue;
      await col.doc(id).update({ status: 'granted', grantedAt: Date.now() });
      updated++;
    } catch (error) {
      console.warn('[wechatPush] mark granted failed:', id, error && error.message ? error.message : error);
    }
  }
  return { updated };
}

function readRawBody(req) {
  let body = (req.raw && req.raw.body) || '';
  if (req.raw && req.raw.isBase64Encoded && body) {
    body = Buffer.from(body, 'base64').toString('utf8');
  }
  return body;
}

async function recordPushMessage(msg, eventName, now) {
  try {
    await collection('wechatPushMessages').add({
      msgType: msg.MsgType || '',
      event: eventName,
      openId: msg.FromUserName || msg.ToUserOpenid || (msg.MiniGame && msg.MiniGame.ToUserOpenid) || '',
      title: msg.Title || '',
      content: msg.Content || '',
      raw: msg,
      createdAt: now,
    });
  } catch (error) {
    console.warn('[wechatPush] record message failed:', error && error.message ? error.message : error);
  }
}

async function recordDeliverGoods(mini, msg, now) {
  const orderId = String(mini.OrderId || '').trim();
  if (!orderId) return;

  const col = collection(PENDING_GIFT_COLLECTION);
  try {
    const existed = await col.where({ orderId }).limit(1).get();
    if (existed && Array.isArray(existed.data) && existed.data.length > 0) return;
  } catch (error) {
    console.warn('[wechatPush] query gift failed:', error && error.message ? error.message : error);
  }

  const openId = String(mini.ToUserOpenid || '').trim();
  const normalized = normalizeGoodsList(mini.GoodsList || []);
  const pendingDoc = {
    orderId,
    userId: openId ? `wx:${openId}` : '',
    rewards: normalized.rewards,
    status: 'pending',
    isPreview: mini.IsPreview || 0,
    createdAt: now,
  };
  if (mini.GiftId) pendingDoc.giftId = mini.GiftId;
  try {
    await col.add(pendingDoc);
  } catch (error) {
    console.warn('[wechatPush] record gift failed:', error && error.message ? error.message : error);
  }
}

function normalizeGoodsList(goodsList) {
  const rawGoodsList = Array.isArray(goodsList) ? goodsList : [];
  const rewards = {};
  const unknownGoods = [];
  rawGoodsList.forEach((item) => {
    const id = item && item.Id != null ? String(item.Id).trim() : '';
    const num = Number(item && item.Num);
    if (!id || !Number.isFinite(num) || num <= 0) return;
    const key = normalizeRewardKey(id);
    if (!key) {
      unknownGoods.push({ id, num });
      return;
    }
    rewards[key] = (rewards[key] || 0) + num;
  });
  return { rewards, rawGoodsList, unknownGoods };
}

function normalizeGiftRows(rows) {
  return rows.map((row) => ({
    id: row._id || row.id || '',
    orderId: row.orderId || '',
    giftId: row.giftId || '',
    rewards: row.rewards || {},
    createdAt: row.createdAt || 0,
  })).filter(row => row.id && row.rewards && Object.keys(row.rewards).length > 0);
}

function normalizeRewardKey(id) {
  const key = String(id || '').trim();
  const lower = key.toLowerCase();
  if (lower === 'stamina' || lower === 'energy') return 'stamina';
  if (lower === 'diamond' || lower === 'diamonds' || lower === 'gem') return 'diamond';
  if (lower === 'huayuan' || lower === 'coin' || lower === 'coins') return 'huayuan';
  if (lower === 'flowersign' || lower === 'flower_sign') return 'flowerSign';
  if (/^[a-z][a-z0-9_]{1,63}$/.test(key)) return key;
  return '';
}

function parsePostBody(body) {
  const text = String(body || '').trim();
  if (!text) return {};
  if (text[0] === '{') return normalizeJsonMessage(JSON.parse(text));
  if (text[0] === '<') return parseXmlMessage(text);
  throw new Error('unknown body format');
}

function normalizeJsonMessage(input) {
  const msg = input || {};
  if (msg.MiniGame || !msg.minigame) return msg;
  return { ...msg, MiniGame: msg.minigame };
}

function parseXmlMessage(xml) {
  const msg = {
    ToUserName: xmlText(xml, 'ToUserName'),
    FromUserName: xmlText(xml, 'FromUserName'),
    CreateTime: xmlNumber(xml, 'CreateTime'),
    MsgType: xmlText(xml, 'MsgType'),
    Event: xmlText(xml, 'Event'),
    Title: xmlText(xml, 'Title'),
    Content: xmlText(xml, 'Content'),
  };
  const miniXml = xmlText(xml, 'MiniGame');
  if (miniXml) {
    const goodsList = [];
    const goodsReg = /<GoodsList>([\s\S]*?)<\/GoodsList>/gi;
    let match;
    while ((match = goodsReg.exec(miniXml))) {
      const itemXml = match[1];
      goodsList.push({ Id: xmlText(itemXml, 'Id'), Num: xmlNumber(itemXml, 'Num') });
    }
    msg.MiniGame = {
      OrderId: xmlText(miniXml, 'OrderId'),
      IsPreview: xmlNumber(miniXml, 'IsPreview'),
      ToUserOpenid: xmlText(miniXml, 'ToUserOpenid'),
      Zone: xmlNumber(miniXml, 'Zone'),
      GiftTypeId: xmlNumber(miniXml, 'GiftTypeId'),
      GiftId: xmlText(miniXml, 'GiftId'),
      SendTime: xmlNumber(miniXml, 'SendTime'),
      GoodsList: goodsList,
    };
  }
  return msg;
}

function xmlText(xml, tag) {
  const reg = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = String(xml || '').match(reg);
  if (!match) return '';
  return String(match[1] || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function xmlNumber(xml, tag) {
  const n = Number(xmlText(xml, tag));
  return Number.isFinite(n) ? n : 0;
}

function checkSignature(signature, timestamp, nonce) {
  if (!signature || !timestamp || !nonce) return false;
  return getWechatPushTokens().some((token) => {
    const hash = crypto.createHash('sha1').update([token, timestamp, nonce].sort().join('')).digest('hex');
    return hash === signature;
  });
}

module.exports = {
  handleWechatPushVerify,
  handleWechatPushCallback,
  handleQueryPendingWechatGifts,
  handleMarkWechatGiftsGranted,
};
