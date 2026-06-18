export const TUTORIAL_COPY = {
  storyIntro: {
    text: '假如你拥有一家花店……\n合成鲜花、招待客人，\n把它经营成最温暖的小店吧！',
    buttonText: '开始打理花店',
  },
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
  shopCompleteDialog: {
    title: '装修能升级',
    body: '装修花店会攒星升级，\n看上方星星和进度条。',
    emphasisText: '升级后会获得更加高级的合成工具哦',
    buttonText: '回去继续做花束',
  },
  tutorialGift: {
    title: '引导完成啦',
    subtitle: '恭喜完成引导！获得：',
    body: '从这里开始，经营属于你自己的花店吧。\n加油，让花花妙屋成为小镇最棒的花店！',
    buttonText: '开始游戏',
  },
} as const;
