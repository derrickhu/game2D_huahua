// 最早加载：宿主识别 + 抖音隐私兜底（须在 pixi-adapter / game-bundle 之前）
var _runtime = require('./runtime.js');
var _nativeApi = _runtime.getNativePlatformApi();

// ====== 最早期诊断 ======
// 鸿蒙上"卡在转圈、控制台出不来"的情况，用 showModal 弹窗显示诊断信息
var _diagMsgs = [];
var _diagStart = Date.now();
function _diag(msg) {
  var ts = Date.now() - _diagStart;
  var line = '[' + ts + 'ms] ' + msg;
  _diagMsgs.push(line);
  try { console.log(line); } catch(_) {}
}

function _dumpRecentXhr(reason) {
  try {
    var g = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : null);
    var logs = g && g.__xhrDebugLogs;
    if (!logs || !logs.length) {
      console.warn('[XHR-DUMP]', reason, 'no xhr logs');
      return;
    }
    var start = Math.max(0, logs.length - 30);
    console.warn('[XHR-DUMP]', reason, 'recent=' + (logs.length - start) + '/' + logs.length);
    for (var i = start; i < logs.length; i++) {
      console.warn(logs[i]);
    }
  } catch (e) {
    try { console.warn('[XHR-DUMP] failed:', e); } catch (_) {}
  }
}

// 弹窗显示诊断信息（控制台出不来时的最后手段）
function _showDiag() {
  try {
    if (_nativeApi && _nativeApi.showModal) {
      _nativeApi.showModal({
        title: '启动诊断',
        content: _diagMsgs.join('\n'),
        showCancel: false
      });
    }
  } catch(_) {}
}

_diag('game.js 开始执行, host=' + _runtime.detectMinigamePlatform());

// 获取系统信息（用弹窗展示，不依赖控制台）
try {
  if (_nativeApi) {
    var _si = _nativeApi.getSystemInfoSync();
    _diag('platform:' + _si.platform + ' system:' + _si.system);
    _diag('brand:' + _si.brand + ' model:' + _si.model);
    _diag('hostver:' + _si.version + ' SDKver:' + _si.SDKVersion);
  }
} catch(e) {
  _diag('getSystemInfo失败:' + e);
}

// ====== 抖音必接能力探测：侧边栏复访 + 添加到桌面 ======
// onShow 首次回调可能早于 bundle 执行，必须在这里就接住启动参数。
(function () {
  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.__launchInfo = {};
    GameGlobal.__sidebarSupported = false;
    GameGlobal.__desktopShortcutSupported = false;
    GameGlobal.__desktopShortcutStatus = null;
  }
  if (!_nativeApi || _runtime.detectMinigamePlatform() !== 'douyin') return;

  try {
    if (typeof _nativeApi.onShow === 'function') {
      _nativeApi.onShow(function (res) {
        if (typeof GameGlobal !== 'undefined') GameGlobal.__launchInfo = res || {};
      });
    }
    var _enter = typeof _nativeApi.getEnterOptionsSync === 'function'
      ? _nativeApi.getEnterOptionsSync()
      : null;
    if (_enter && typeof GameGlobal !== 'undefined') GameGlobal.__launchInfo = _enter;
  } catch (e) {
    _diag('onShow 注册失败:' + e);
  }

  try {
    if (typeof _nativeApi.checkScene === 'function') {
      _nativeApi.checkScene({
        scene: 'sidebar',
        success: function (res) {
          if (typeof GameGlobal !== 'undefined') {
            GameGlobal.__sidebarSupported = !!(res && res.isExist);
          }
        },
        fail: function () {
          if (typeof GameGlobal !== 'undefined') GameGlobal.__sidebarSupported = false;
        }
      });
    }
  } catch (_) {}

  try {
    if (typeof _nativeApi.addShortcut === 'function' && typeof GameGlobal !== 'undefined') {
      GameGlobal.__desktopShortcutSupported = true;
    }
    if (typeof _nativeApi.checkShortcut === 'function') {
      _nativeApi.checkShortcut({
        success: function (res) {
          if (typeof GameGlobal !== 'undefined') {
            GameGlobal.__desktopShortcutStatus = res && res.status ? res.status : null;
          }
        },
        fail: function () {}
      });
    }
  } catch (_) {}
})();

// 全局错误捕获——鸿蒙等设备 adapter 阶段崩溃无日志，必须最先注册
try {
  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.onError = function(msg) {
      _diag('onError:' + msg);
      _dumpRecentXhr('onError');
      _showDiag();
    };
    GameGlobal.onUnhandledRejection = function(ev) {
      _diag('unhandledRej:' + (ev && ev.reason || ev));
      _dumpRecentXhr('onUnhandledRejection');
      _showDiag();
    };
  }
} catch(_) {}

// ====== 加载 adapter ======
_diag('加载 pixi-adapter...');
try {
  require('./pixi-adapter/index');
  _diag('pixi-adapter OK');
} catch (e) {
  _diag('pixi-adapter 失败!!:' + e);
  _showDiag();
}

// ====== 鸿蒙 Intl polyfill ======
// 鸿蒙版微信 V8 引擎不含 ICU，Intl 对象不存在
// PixiJS graphemeSegmenter 中 `Intl==null?...` 会触发 ReferenceError
// 注入一个最小 Intl stub，让 PixiJS 安全降级到 [...str] 分割
if (typeof Intl === 'undefined') {
  _diag('Intl不存在,注入polyfill');
  var _g = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : {});
  _g.Intl = {};
}

// ====== 加载 game-bundle ======
_diag('加载 game-bundle...');
try {
  require('./game-bundle.js');
  _diag('game-bundle OK');
} catch (e) {
  _diag('game-bundle 失败!!:' + e);
  _showDiag();
}

_diag('全部加载完成');

// 5秒后如果还没有渲染，自动弹窗显示诊断（兜底）
setTimeout(function() {
  if (typeof GameGlobal !== 'undefined' && !GameGlobal.__gameRendered) {
    _diag('5秒超时 - 游戏未渲染');
    _showDiag();
  }
}, 5000);
