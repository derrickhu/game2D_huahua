/** 1 级玩家花愿达到该值且仅拥有 1 件家具时，合成页弹出买家具提醒（非强制） */
export const BUY_FURNITURE_HINT_HUAYUAN_MIN = 300;

/** 触发提醒时的玩家等级上限（1 级为主；刚升到 2 级仍补一次，避免被签到/公告挡住后错过） */
export const BUY_FURNITURE_HINT_PLAYER_LEVEL = 1;

/** 已拥有家具件数上限（含教程购入的 1 件） */
export const BUY_FURNITURE_HINT_OWNED_MAX = 1;
