export const TUTORIAL_COPY = {
  boardIntroOpen: {
    title: '花店开业啦',
    body: '欢迎来到花花妙屋！\n客人已经来了，我们去整理台准备花材吧。',
    actionText: '整理台可以合成工具、培育鲜花',
  },
  boardIntroPeek: {
    title: '丝带盒',
    body: '这个盒子被丝带绑住了。\n把一样的物品合上去，就能打开。',
    actionText: '找一样的物品拖上去',
  },
  boardIntroFogKey: {
    title: '神秘盒子',
    body: '盒子里藏着花店用得上的惊喜。\n有些盒子现在打不开，需要先解开旁边的格子。',
    actionText: '带小标记的盒子有特殊条件，之后可以试试',
  },
  mergeTool: {
    unlockTitle: '解锁铲子',
    unlockBody: '丝带盒里也有一把铲子。\n把同样的铲子拖上去，打开盒子！',
    mergeTitle: '合成工具',
    mergeBody: '把两个相同工具拖到一起，\n合成更高级的工具。',
    continueTitle: '继续合成',
    continueBody: '再合成一次，升级成育苗盘，\n就能培育花朵了。',
    actionText: '拖动高亮工具到目标格',
    invalidActionText: '拖错会回到原位，按手指提示再试一次',
  },
  tapTool: {
    title: '培育花朵',
    body: '点击育苗盘就可以培育花朵。\n快试试吧。',
    actionText: '点击高亮育苗盘',
  },
  furniturePlace: {
    dragTitle: '摆放家具',
    dragBody: '新家具已经拿出来了。\n拖到房间空地上，就能放下。',
    dragAction: '拖动家具到高亮区域',
    finishTitle: '保存装修',
    finishBody: '家具已经摆好啦。\n点击完成装修，保存这次布置。',
    finishAction: '点击完成装修',
    invalidAction: '拖到房间空地上就可以摆放',
  },
} as const;
