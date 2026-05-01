#!/usr/bin/env python3
"""
软件著作权登记 - 文档鉴别材料（设计说明书）PDF 生成工具
项目: 花花妙屋小游戏软件

说明:
  本脚本用于生成“花花妙屋”游戏软著设计说明书。正文已按本游戏
  游戏系统、模块、数据结构和接口编写。截图若未准备，会在 PDF 中
  自动生成“待补截图”占位框，并在运行报告中输出缺图清单。
"""

import warnings
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import WrapMode
from PIL import Image

warnings.filterwarnings("ignore", category=DeprecationWarning)


# ======================= 配置区 =======================

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = Path('/Users/huyi/dk_proj/game2D_huahua')
OUTPUT = SCRIPT_DIR / '软著文档-花花妙屋-V1.0.0.pdf'

SOFTWARE_FULL_NAME = '深圳幸运呱科技有限公司花花妙屋小游戏软件'
SOFTWARE_VERSION = 'V1.0.0'
APPLICANT_NAME = '深圳幸运呱科技有限公司'

SONGTI_PATH = '/System/Library/Fonts/Supplemental/Songti.ttc'

BODY_FONT_SIZE = 10.5
H1_FONT_SIZE = 16
H2_FONT_SIZE = 14
H3_FONT_SIZE = 12
CODE_FONT_SIZE = 9
HEADER_FONT_SIZE = 10
FOOTER_FONT_SIZE = 9

LINE_HEIGHT = 6.5
CODE_LINE_HEIGHT = 5.0
H1_LINE_HEIGHT = 10
H2_LINE_HEIGHT = 8.5
H3_LINE_HEIGHT = 7.5

LEFT_MARGIN = 25
RIGHT_MARGIN = 20
TOP_MARGIN = 15
BOTTOM_MARGIN = 15

PAGE_W = 210
PAGE_H = 297
CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN
CONTENT_TOP = TOP_MARGIN + 10

HEADER_TEXT = f'{SOFTWARE_FULL_NAME} {SOFTWARE_VERSION} 设计说明书'

PICS_DIR = SCRIPT_DIR / 'pics'


def _pic(*names):
    """按候选文件名查找截图，允许 jpg/png 和中文业务名混用。"""
    for name in names:
        path = PICS_DIR / name
        if path.exists():
            return path
    return PICS_DIR / names[0]


SCREENSHOTS = {
    'main': [(_pic('huahua_01_main.jpg', 'huahua_01_main.png'),
              '图1  花店主界面 - 订单、货币、棋盘入口与底部功能栏')],
    'board': [(_pic('huahua_02_board.jpg', 'huahua_02_board.png'),
               '图2  合成棋盘界面 - 鲜花物品拖拽、合成与产出')],
    'order': [(_pic('huahua_03_order.jpg', 'huahua_03_order.png'),
               '图3  订单交付界面 - 客人需求、奖励与交付反馈')],
    'tool_items': [(_pic('工具.png', '工具物品.jpg', 'tool_items.jpg', 'tool_items.png'),
                    '图3-1  工具物品解锁路径 - 工具产线、等级成长与产出关系')],
    'drink_items': [(_pic('饮品.jpg', '饮品.png', 'drink_items.jpg', 'drink_items.png'),
                     '图3-2  饮品线物品解锁路径 - 饮品等级链路与订单需求扩展')],
    'decoration': [
        (_pic('huahua_04_装修.jpg', 'huahua_04_decoration.jpg', 'huahua_04_decoration.png'),
         '图4-1  装修界面 - 房间布置与家具摆放预览'),
        (_pic('huahua_04_家具列表.jpg', 'huahua_04_furniture.jpg', 'huahua_04_furniture.png'),
         '图4-2  家具列表 - 家具分类、状态与选择入口'),
    ],
    'dressup': [(_pic('huahua_05_dressup.jpg', 'huahua_05_dressup.png'),
                 '图5  换装界面 - 店主服装收集与穿戴')],
    'collection': [(_pic('huahua_06_collection.jpg', 'huahua_06_collection.png'),
                    '图6  图鉴界面 - 花卡、分页与奖励收集')],
    'checkin': [(_pic('huahua_07_签到.jpg', 'huahua_07_checkin.jpg', 'huahua_07_checkin.png'),
                 '图7-1  签到界面 - 7 日签到、累计奖励与广告加餐')],
    'daily': [(_pic('huahua_07_任务.jpg', 'huahua_07_daily.jpg', 'huahua_07_daily.png'),
               '图7-2  每日任务界面 - 任务进度、周积分与奖励领取')],
    'levelup': [(_pic('huahua_08_升级.jpg', 'huahua_08_levelup.jpg', 'huahua_08_levelup.png'),
                 '图8  升级弹窗 - 等级提升与新内容解锁预览')],
    'map': [(_pic('huahua_09_大地图.jpg', 'huahua_09_map.jpg', 'huahua_09_map.png'),
             '图9-1  大地图界面 - 多场景入口、锁定节点与功能建筑')],
    'wish': [(_pic('huahua_09_许愿.png', 'huahua_09_wish.jpg', 'huahua_09_wish.png'),
              '图9-2  许愿喷泉界面 - 抽奖入口、奖池与消耗展示')],
}


class DocPDF(FPDF):
    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.set_left_margin(LEFT_MARGIN)
        self.set_right_margin(RIGHT_MARGIN)
        self.set_top_margin(CONTENT_TOP)
        self.set_auto_page_break(auto=True, margin=BOTTOM_MARGIN + 10)
        self.missing_images = []

    def header(self):
        self.set_font('Songti', '', HEADER_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.set_xy(LEFT_MARGIN, TOP_MARGIN)
        self.cell(0, 6, HEADER_TEXT, new_x='LEFT', new_y='TOP')
        page_str = str(self.page_no())
        tw = self.get_string_width(page_str)
        self.set_xy(PAGE_W - RIGHT_MARGIN - tw, TOP_MARGIN)
        self.cell(tw, 6, page_str, new_x='LEFT', new_y='TOP')
        line_y = TOP_MARGIN + 7
        self.set_draw_color(0, 0, 0)
        self.set_line_width(0.4)
        self.line(LEFT_MARGIN, line_y, PAGE_W - RIGHT_MARGIN, line_y)
        self.set_y(CONTENT_TOP)

    def footer(self):
        footer_y = PAGE_H - BOTTOM_MARGIN
        self.set_xy(LEFT_MARGIN, footer_y)
        self.set_font('Songti', '', FOOTER_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.cell(CONTENT_W, 5, APPLICANT_NAME, align='C')

    def check_page_break(self, h):
        if self.get_y() + h > PAGE_H - BOTTOM_MARGIN - 10:
            self.add_page()

    def write_h1(self, text):
        self.check_page_break(H1_LINE_HEIGHT + 5)
        self.ln(4)
        self.set_font('Songti', '', H1_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.set_x(LEFT_MARGIN)
        self.cell(CONTENT_W, H1_LINE_HEIGHT, _safe_text(text), new_x='LMARGIN', new_y='NEXT')
        self.ln(2)

    def write_h2(self, text):
        self.check_page_break(H2_LINE_HEIGHT + 4)
        self.ln(3)
        self.set_font('Songti', '', H2_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.set_x(LEFT_MARGIN)
        self.cell(CONTENT_W, H2_LINE_HEIGHT, _safe_text(text), new_x='LMARGIN', new_y='NEXT')
        self.ln(1.5)

    def write_h3(self, text):
        self.check_page_break(H3_LINE_HEIGHT + 3)
        self.ln(2)
        self.set_font('Songti', '', H3_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.set_x(LEFT_MARGIN)
        self.cell(CONTENT_W, H3_LINE_HEIGHT, _safe_text(text), new_x='LMARGIN', new_y='NEXT')
        self.ln(1)

    def write_body(self, text, indent=0):
        self.set_font('Songti', '', BODY_FONT_SIZE)
        self.set_text_color(30, 30, 30)
        self.set_x(LEFT_MARGIN + indent)
        self.multi_cell(CONTENT_W - indent, LINE_HEIGHT, _safe_text(text),
                        new_x='LMARGIN', new_y='NEXT', wrapmode=WrapMode.CHAR)

    def write_bullet(self, text, level=0):
        indent = 4 + level * 4
        bullet = '  ' * level + ('- ' if level > 0 else '* ')
        self.write_body(bullet + text, indent=indent)

    def write_code_block(self, lines):
        self.ln(1)
        self.set_font('Songti', '', CODE_FONT_SIZE)
        self.set_text_color(40, 40, 40)
        for line in lines:
            self.check_page_break(CODE_LINE_HEIGHT)
            self.set_fill_color(245, 245, 245)
            self.set_x(LEFT_MARGIN + 4)
            self.cell(CONTENT_W - 4, CODE_LINE_HEIGHT, _safe_text(line.replace('\t', '    ')),
                      fill=True, new_x='LMARGIN', new_y='NEXT')
        self.ln(1)

    def write_table(self, headers, rows, col_widths=None):
        self.ln(1)
        if col_widths is None:
            col_widths = [CONTENT_W / len(headers)] * len(headers)
        row_line_h = 5.6
        pad_x = 1.5
        pad_y = 1.5

        def wrap_cell(text, width):
            text = _safe_text(str(text))
            lines = []
            for paragraph in text.split('\n'):
                current = ''
                for ch in paragraph:
                    if self.get_string_width(current + ch) <= width:
                        current += ch
                    else:
                        if current:
                            lines.append(current)
                        current = ch
                lines.append(current)
            return lines or ['']

        def draw_row(cells, fill, bold=False):
            self.set_font('Songti', '', BODY_FONT_SIZE)
            wrapped = [wrap_cell(c, col_widths[i] - pad_x * 2) for i, c in enumerate(cells)]
            row_h = max(len(lines) for lines in wrapped) * row_line_h + pad_y * 2
            self.check_page_break(row_h)

            y0 = self.get_y()
            x = LEFT_MARGIN
            self.set_fill_color(*fill)
            self.set_draw_color(0, 0, 0)
            for i, lines in enumerate(wrapped):
                self.rect(x, y0, col_widths[i], row_h, style='DF')
                self.set_xy(x + pad_x, y0 + pad_y)
                for line in lines:
                    self.cell(col_widths[i] - pad_x * 2, row_line_h, line,
                              new_x='LEFT', new_y='NEXT')
                    self.set_x(x + pad_x)
                x += col_widths[i]
            self.set_y(y0 + row_h)

        self.set_font('Songti', '', BODY_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        draw_row(headers, (230, 230, 230), bold=True)
        for row in rows:
            self.set_text_color(30, 30, 30)
            draw_row(row, (255, 255, 255))
        self.ln(1)

    def write_image(self, img_path, caption='', max_h=90):
        img_path = Path(img_path)
        if not img_path.exists():
            self._write_image_placeholder(img_path, caption)
            return

        img = Image.open(img_path)
        iw, ih = img.size
        max_w = CONTENT_W * 0.48
        ratio = min(max_w / iw, max_h / ih)
        draw_w = iw * ratio
        draw_h = ih * ratio
        total_h = draw_h + 18
        self.check_page_break(total_h)
        self.ln(3)
        x = LEFT_MARGIN + (CONTENT_W - draw_w) / 2
        self.image(str(img_path), x=x, y=self.get_y(), w=draw_w, h=draw_h)
        self.set_y(self.get_y() + draw_h + 2)
        if caption:
            self.set_font('Songti', '', 9)
            self.set_text_color(100, 100, 100)
            self.set_x(LEFT_MARGIN)
            self.cell(CONTENT_W, 5, _safe_text(caption), align='C', new_x='LMARGIN', new_y='NEXT')
            self.set_text_color(30, 30, 30)
        self.ln(3)

    def write_image_row(self, image_entries, max_h=82):
        if len(image_entries) <= 1:
            path, caption = image_entries[0]
            self.write_image(path, caption, max_h=max_h)
            return

        paths = [Path(path) for path, _ in image_entries]
        if any(not path.exists() for path in paths):
            for path, caption in image_entries:
                self.write_image(path, caption, max_h=max_h)
            return

        images = [Image.open(path) for path in paths]
        gap = 6
        max_w = (CONTENT_W - gap * (len(images) - 1)) / len(images)
        sizes = []
        for im in images:
            iw, ih = im.size
            ratio = min(max_w / iw, max_h / ih)
            sizes.append((iw * ratio, ih * ratio))

        row_h = max(h for _, h in sizes)
        total_h = row_h + 22
        self.check_page_break(total_h)
        self.ln(3)

        y = self.get_y()
        x = LEFT_MARGIN
        for (path, caption), (draw_w, draw_h) in zip(image_entries, sizes):
            img_x = x + (max_w - draw_w) / 2
            img_y = y + (row_h - draw_h) / 2
            self.image(str(path), x=img_x, y=img_y, w=draw_w, h=draw_h)
            self.set_xy(x, y + row_h + 2)
            self.set_font('Songti', '', 8.5)
            self.set_text_color(100, 100, 100)
            self.multi_cell(max_w, 4.6, _safe_text(caption), align='C',
                            new_x='RIGHT', new_y='TOP')
            x += max_w + gap

        self.set_y(y + total_h)
        self.set_text_color(30, 30, 30)
        self.ln(2)

    def _write_image_placeholder(self, img_path, caption):
        self.missing_images.append((str(img_path), caption))
        box_h = 58
        self.check_page_break(box_h + 16)
        self.ln(3)
        x = LEFT_MARGIN + CONTENT_W * 0.22
        w = CONTENT_W * 0.56
        y = self.get_y()
        self.set_draw_color(120, 120, 120)
        self.set_fill_color(248, 248, 248)
        self.rect(x, y, w, box_h, style='DF')
        self.set_font('Songti', '', 11)
        self.set_text_color(120, 120, 120)
        self.set_xy(x, y + 18)
        self.cell(w, 7, '待补游戏截图', align='C', new_x='LEFT', new_y='NEXT')
        self.set_xy(x, y + 28)
        self.cell(w, 7, img_path.name, align='C', new_x='LEFT', new_y='NEXT')
        self.set_y(y + box_h + 2)
        self.set_font('Songti', '', 9)
        self.set_text_color(100, 100, 100)
        self.set_x(LEFT_MARGIN)
        self.cell(CONTENT_W, 5, _safe_text(caption + '（截图占位）'), align='C',
                  new_x='LMARGIN', new_y='NEXT')
        self.set_text_color(30, 30, 30)
        self.ln(3)

    def write_spacer(self, h=3):
        self.ln(h)


def _safe_text(text):
    replacements = {
        '→': '->', '←': '<-', '↑': '^', '↓': 'v', '★': '*', '✅': '[OK]',
        '⚠': '[!]', '✕': 'x', '“': '"', '”': '"', '‘': "'", '’': "'",
        '—': '-', '·': '.', '：': ':', '（': '(', '）': ')',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return ''.join(c if ord(c) <= 0xFFFF else '?' for c in text)


def img(key):
    return SCREENSHOTS[key][0]


def imgs(key):
    return SCREENSHOTS[key]


def write_document(pdf):
    """编写花花妙屋设计说明书全部内容。"""

    pdf.add_page()
    pdf.write_h1('目  录')
    toc_items = [
        '一、引言',
        '    1.1 编写目的',
        '    1.2 软件概述',
        '    1.3 运行环境',
        '    1.4 术语与缩略语',
        '二、软件总体设计',
        '    2.1 软件需求概括',
        '    2.2 总体架构设计',
        '    2.3 模块划分与关系',
        '    2.4 场景与界面系统设计',
        '    2.5 主循环与资源加载设计',
        '三、核心模块详细设计',
        '    3.1 游戏入口与平台适配模块',
        '    3.2 合成棋盘与合成链设计',
        '    3.3 工具产出、体力与特殊道具设计',
        '    3.4 订单与客人模块',
        '    3.5 订单定价、档位与扩展设计',
        '    3.6 经济与奖励模块',
        '    3.7 装修与房间布局模块',
        '    3.8 换装与角色展示模块',
        '    3.9 图鉴系统设计',
        '    3.10 签到系统设计',
        '    3.11 每日挑战与任务系统设计',
        '    3.12 大地图系统设计',
        '    3.13 许愿喷泉系统设计',
        '    3.14 存档与云同步模块',
        '四、数据结构设计',
        '五、数据接口设计',
        '六、出错处理设计',
        '七、性能优化设计',
    ]
    for item in toc_items:
        pdf.write_body(item)

    # =============== 一、引言 ===============
    pdf.add_page()
    pdf.write_h1('一、引言')
    pdf.write_h2('1.1 编写目的')
    pdf.write_body(
        f'编写本设计说明书是{SOFTWARE_FULL_NAME} {SOFTWARE_VERSION}软件著作权登记材料的一部分。'
        '本文档用于说明本软件的功能范围、总体架构、核心模块、数据结构、接口设计、异常处理和性能优化方案，'
        '证明本软件为独立开发完成的原创游戏软件。'
    )
    pdf.write_body(
        '本文档面向软件著作权审查人员及后续维护人员，重点描述软件技术实现，不包含运营数据、用户隐私数据和商业敏感策略。'
    )

    pdf.write_h2('1.2 软件概述')
    pdf.write_body(
        '花花妙屋是一款基于微信小游戏运行环境开发的休闲合成经营游戏。玩家在温馨花店场景中，'
        '通过棋盘合成鲜花、饮品和工具等物品，完成客人订单，获得金币、钻石、星星和装饰资源，'
        '逐步解锁花店装修、店主换装、花卡图鉴、签到任务和活动挑战等内容。'
    )
    pdf.write_body('本软件的主要功能包括:')
    for text in [
        '合成棋盘系统: 支持格子状态、物品拖拽、同级合成、产出冷却、宝箱与奖励散落。',
        '订单与客人系统: 根据当前进度生成客人需求，完成订单后发放货币、经验、道具等奖励。',
        '花店经营系统: 管理金币、钻石、星星、体力等资源，驱动装修、升级与任务进度。',
        '装修系统: 支持花店房间家具解锁、摆放、风格展示和房间布局持久化。',
        '换装系统: 支持店主服装收集、穿戴、星级礼包与界面展示。',
        '图鉴收集系统: 管理花卡收集状态、分页展示、宝箱奖励与收纳奖励。',
        '日常系统: 包含签到、任务、活动、挑战、空闲收益和新手引导。',
        '存档同步系统: 使用本地 Storage 与 CloudBase HTTP 后端进行存档同步，按平台隔离账号数据。',
    ]:
        pdf.write_bullet(text)
    p, c = img('main')
    pdf.write_image(p, c)

    pdf.write_h2('1.3 运行环境')
    pdf.write_table(
        ['环境项', '要求说明'],
        [
            ['客户端平台', '微信小游戏；后续可扩展到抖音、TapTap、H5 等平台'],
            ['开发语言', 'TypeScript、JavaScript'],
            ['渲染框架', 'PixiJS / Canvas / WebGL 运行环境'],
            ['构建工具', 'npm、TypeScript、项目打包脚本'],
            ['后端平台', '腾讯云 CloudBase 云函数 + HTTP 访问服务'],
            ['数据存储', '微信 Storage / 浏览器 localStorage / CloudBase 文档数据库'],
        ],
        [36, 129],
    )

    pdf.write_h2('1.4 术语与缩略语')
    pdf.write_table(
        ['术语', '含义说明'],
        [
            ['Merge', '合成玩法，将相同等级物品合并生成更高等级物品'],
            ['Item', '棋盘中的鲜花、工具、饮品、宝箱、红包等可交互物品'],
            ['Order', '客人订单，描述需要提交的物品及完成后的奖励'],
            ['CloudSync', '本地存档与云端存档之间的同步机制'],
            ['JWT', 'JSON Web Token，用于后端鉴权和平台账号识别'],
            ['GAME_KEY', '游戏代号，用于集合名、token key、存档 key 等多游戏隔离'],
        ],
        [36, 129],
    )

    # =============== 二、软件总体设计 ===============
    pdf.write_h1('二、软件总体设计')
    pdf.write_h2('2.1 软件需求概括')
    pdf.write_body(
        '本软件采用模块化、事件驱动的设计方式。客户端负责游戏循环、界面渲染、输入交互、本地存档和资源加载；'
        '后端负责平台登录、JWT 签发、云端存档读写、并发版本校验和跨平台账号隔离。'
    )
    pdf.write_body('软件核心需求包括以下几个方面:')
    for text in [
        '提供稳定的合成棋盘玩法，包括拖拽、交换、合成、产出、消耗和刷新。',
        '提供花店经营进度，包括订单完成、资源增长、等级提升、家具解锁和服装解锁。',
        '提供多界面 UI，包括主界面、棋盘、装修、换装、图鉴、签到、任务、活动与弹窗。',
        '提供可靠的本地存档与云存档，保证退出、断网、重进及不同设备之间的存档一致性。',
        '提供资源分包与缓存机制，降低主包体积并提升启动体验。',
    ]:
        pdf.write_bullet(text)

    pdf.write_h2('2.2 总体架构设计')
    pdf.write_body(
        '软件整体架构可划分为入口层、平台适配层、核心服务层、管理器层、UI 表现层、资源层和后端服务层。'
        '各层之间通过明确的接口协作，降低具体平台 API、渲染对象和业务逻辑之间的耦合度。'
    )
    pdf.write_code_block([
        'minigame/game.js',
        '  +-- src/main.ts                 游戏启动、Pixi 初始化、生命周期绑定',
        '  +-- core/PlatformService.ts     微信/抖音/H5 平台能力适配',
        '  +-- core/PersistService.ts      本地持久化与云同步白名单管理',
        '  +-- core/BackendService.ts      HTTP 登录、pull、push 请求封装',
        '  +-- managers/*                  棋盘、订单、装修、换装、图鉴、签到等业务管理器',
        '  +-- gameobjects/ui/*            面板、按钮、弹窗、底部导航等 UI 对象',
        '  +-- utils/TextureCache.ts       纹理缓存、分包加载、资源容错',
        '  +-- cloudfunctions/huahua-api   CloudBase HTTP 后端服务',
    ])

    pdf.write_h2('2.3 模块划分与关系')
    pdf.write_table(
        ['模块层', '代表文件/对象', '功能简述'],
        [
            ['入口层', 'main.ts / game.js', '完成游戏初始化、主循环、生命周期和启动同步'],
            ['平台层', 'PlatformService', '封装 request、storage、login、生命周期等平台 API'],
            ['服务层', 'PersistService / BackendService', '封装本地存储、云同步快照、后端 HTTP 调用'],
            ['管理器层', 'BoardManager / SaveManager / CloudSyncManager 等', '负责各业务域状态和规则'],
            ['UI 层', 'DecorationPanel / DressUpPanel / CollectionPanel 等', '绘制界面、处理点击和反馈'],
            ['资源层', 'TextureCache / subpackages', '加载图片、分包、纹理映射和容错日志'],
            ['后端层', 'huahua-api', '平台登录、JWT 鉴权、存档拉取与上传'],
        ],
        [28, 50, 87],
    )
    pdf.write_body(
        '模块之间采用“入口调度、服务抽象、管理器持有状态、UI 订阅并触发业务”的协作方式。'
        'UI 层不直接操作平台 API 和后端接口，而是通过管理器或核心服务完成，保证各平台复用同一套游戏规则。'
    )
    pdf.write_code_block([
        'main.ts -> 初始化 Pixi 应用、TextureCache、各 Manager',
        'UI Panel -> 调用 Manager 方法 -> 修改业务状态',
        'PersistService.subscribe(changedKeys) -> CloudSyncManager.scheduleSync(reason)',
        'BackendService.request(path, body) -> PlatformService.request -> CloudBase HTTP',
    ])

    pdf.write_h2('2.4 场景与界面系统设计')
    pdf.write_body(
        '软件采用单页面小游戏结构，通过主界面和多个弹窗/面板组合完成业务流程。主界面用于显示花店、货币、订单入口和底部导航；'
        '棋盘界面用于核心合成；装修、换装、图鉴、签到、任务等界面通过独立面板对象管理。'
    )
    p, c = img('board')
    pdf.write_image(p, c)

    pdf.write_h2('2.5 主循环与资源加载设计')
    pdf.write_body(
        '游戏启动时先初始化渲染器、纹理缓存、管理器和云同步预热逻辑。资源加载采用 TextureCache 统一管理，'
        '针对角色、物品、装修、面板等资源按分包加载，加载失败时输出详细 errMsg 和原始错误对象，便于定位。'
    )
    pdf.write_body(
        '主循环负责驱动场景更新、动画更新、输入状态处理和定时自动存档。切后台时触发立即存档与云端 flush，降低异常退出造成的数据丢失风险。'
    )

    # =============== 三、核心模块详细设计 ===============
    pdf.write_h1('三、核心模块详细设计')
    pdf.write_h2('3.1 游戏入口与平台适配模块')
    pdf.write_body(
        '游戏入口模块完成 Pixi 应用初始化、舞台创建、主界面挂载、启动期云同步等待、生命周期事件绑定等工作。'
        '平台适配模块通过 PlatformService 统一封装微信、抖音和 H5 的差异，包括 storage、request、login、onHide、onShow、share 等能力。'
    )
    pdf.write_code_block([
        'PlatformService.request(options) -> wx.request / tt.request / fetch',
        'PlatformService.getStorageSync(key) -> 平台同步存储',
        'PlatformService.login() -> wx.login / tt.login',
        'PlatformService.onHide(callback) -> 切后台保存与云同步',
    ])
    pdf.write_body(
        '平台适配模块采用能力检测方式选择具体实现：微信环境优先调用 wx 对象，抖音环境调用 tt 对象，'
        '浏览器环境使用 fetch 和 localStorage。这样业务层只依赖统一接口，不需要在订单、存档或 UI 模块中判断平台类型。'
    )
    pdf.write_code_block([
        'request(options):',
        '  if platform == wechat: return wx.request(options)',
        '  if platform == douyin: return tt.request(options)',
        '  return fetch(url, { method, headers, body })',
        '',
        'onHide(callback):',
        '  wx.onHide(callback) / tt.onHide(callback)',
        '  callback 中执行 SaveManager.save 与 CloudSyncManager.flushNow',
    ])

    pdf.write_h2('3.2 合成棋盘与合成链设计')
    pdf.write_body(
        '合成棋盘是本软件的核心玩法模块。棋盘由固定数量格子组成，每个格子保存 row、col、state、itemId 等最小状态；'
        '物品的名称、等级、所属产线、最大等级、交互方式和图标全部由 ItemConfig 配置表提供。'
        '合成规则采用同线同级合成：两个相同 itemId 的普通物品合并后，目标格升级为同产线下一等级，源格清空。'
    )
    pdf.write_table(
        ['对象', '主要字段', '说明'],
        [
            ['BoardCell', 'row, col, state, itemId', '表示棋盘格位置、锁定状态和当前物品'],
            ['ItemDef', 'id, category, line, level, maxLevel, interactType', '表示物品配置、产品线、等级和交互机制'],
            ['BuildingState', 'id, cooldown, charges', '表示产出型建筑和工具冷却状态'],
            ['RewardBoxState', 'queue, openedAt', '表示宝箱与待散落奖励队列'],
        ],
        [34, 55, 76],
    )
    pdf.write_body(
        '合成链按产线分层：鲜花线、绿植线各 13 级，花束线 10 级，包装中间品 4 级；饮品相关包含蝴蝶线 10 级、冷饮线和甜品线各 8 级。'
        '工具线与产品线分离，工具本身可合成升级，但工具点击后产出的是低等级产品或中间材料，形成“工具产出 -> 棋盘合成 -> 订单交付”的闭环。'
    )
    pdf.write_code_block([
        'tryMerge(srcIndex, dstIndex):',
        '  src = board.cells[srcIndex]; dst = board.cells[dstIndex]',
        '  if dst.state == locked: return reject',
        '  if src.itemId == dst.itemId and hasNextLevel(src.itemId):',
        '      dst.itemId = getNextItemId(src.itemId)',
        '      src.itemId = null',
        '      EventBus.emit(\"board:merged\", srcIndex, dstIndex, dst.itemId, dstIndex)',
        '      MergeStatsSystem.recordMerge(dst.itemId)',
        '      PersistService.writeJSON(\"huahua_save\", SaveManager.exportState())',
        '      return merged',
        '  else:',
        '      swap(src.itemId, dst.itemId)',
        '      return moved',
    ])
    pdf.write_body(
        '棋盘还支持半解锁格、钥匙格、格子售卖、仓库转移和宝箱散落等扩展行为。格子状态与物品定义解耦后，'
        '新增物品线或新增格子规则时只需改配置和管理器，不需要重写拖拽、交换、合成的基础流程。'
    )
    pdf.write_table(
        ['产线', '等级/链路', '设计说明'],
        [
            ['鲜花/绿植', '各 13 级', '园艺工具产出低中阶物品，玩家通过合成推进到高阶，作为订单主线'],
            ['花束', '10 级', '由包装材料与花束相关道具推动，补偿额外体力和中间品链路'],
            ['蝴蝶/冷饮/甜品', '10/8/8 级', '由捕虫网、制冰/饮品工具、烘焙工具分别产出，扩展订单种类'],
            ['包装中间品', '4 级', '不直接进订单，作为花束链路的中间材料，提高合成深度'],
        ],
        [36, 38, 91],
    )

    pdf.write_h2('3.3 工具产出、体力与特殊道具设计')
    pdf.write_body(
        '工具系统用于控制物品来源、体力消耗和成长节奏。工具分为园艺、包装、捕虫网、冷饮器具、烘焙工具等产线。'
        '1-2 级工具通常只参与合成，3 级及以上工具逐步开放点击产出。每次点击工具会检查体力是否充足，'
        '再按配置表的权重随机一个产出结果，并把产物散落到空格或奖励箱。'
    )
    pdf.write_table(
        ['工具类型', '产出对象', '体力/CD 设计'],
        [
            ['园艺工具', '鲜花线、绿植线', '从低级花种、芽苗逐步过渡到高阶鲜花/绿植；高级温室有更高等级权重'],
            ['包装工具', '包装中间品', '产出丝带、包装纸、花束材料包；推动花束链路'],
            ['捕虫网', '蝴蝶线', '中高等级工具可以直出更高阶蝴蝶，但高等级权重低'],
            ['制冰/饮品工具', '冷饮线', '最高工具也只直出较低级冷饮，后段主要靠合成推进'],
            ['烘焙工具', '甜品线', '用于甜品订单扩展，和冷饮线共享饮品类订单入口'],
        ],
        [35, 43, 87],
    )
    pdf.write_body(
        '工具产出配置中包含 produceOutcomes、produceTable、cooldown、producesBeforeCooldown、staminaCost、exhaustAfterProduces 等字段。'
        '其中 cooldown 和 producesBeforeCooldown 形成“每周期可产出若干次 -> 进入冷却 -> 冷却恢复次数”的节奏；'
        '花束包装纸等消耗型道具可通过 exhaustAfterProduces 控制用完后从棋盘移除。'
    )
    pdf.write_code_block([
        'produceFromTool(toolCell):',
        '  def = BuildingConfig.getToolDef(toolCell.itemId)',
        '  if !def.canProduce: return',
        '  if CurrencyManager.stamina < def.staminaCost: show(\"体力不足\")',
        '  CurrencyManager.consumeStamina(def.staminaCost)',
        '  result = weightedPick(def.produceOutcomes or def.produceTable)',
        '  BoardManager.placeOrQueueReward(result.itemId)',
        '  toolCell.usesLeft -= 1',
        '  if def.cooldown > 0 and cycleCharges == 0: startCooldown(def.cooldown)',
        '  if def.exhaustAfterProduces reached: remove toolCell.itemId',
    ])
    p, c = img('tool_items')
    pdf.write_image(p, c)
    pdf.write_body(
        '特殊道具用于解决高阶合成过程中的卡点：万能水晶对同线目标升一级；金剪刀将目标拆成两个低一级物品，'
        '其中一个保留在目标格，另一个投放到空格或奖励箱；幸运金币作为单级稀有奖励，不参与普通合成。'
        '这些道具不会直接改变产线配置，而是在拖拽结束时进入确认流程，确认后再提交棋盘数据。'
    )
    pdf.write_code_block([
        'applyCrystalBall(targetCell):',
        '  nextId = getNextItemId(targetCell.itemId)',
        '  if nextId: targetCell.itemId = nextId',
        '',
        'applyGoldenScissors(targetCell):',
        '  prevId = getPrevItemId(targetCell.itemId)',
        '  if prevId:',
        '      targetCell.itemId = prevId',
        '      BoardManager.placeOrQueueReward(prevId)',
    ])
    pdf.write_body(
        '花语泡泡是合成伴生玩法：玩家在全局等级达到 3 级后，每次合成会按规则表掷概率。常驻规则的基础概率为 1.5%，'
        '最多同时存在 4 个漂浮气泡，每次合成最多生成 1 个。气泡不占棋盘格，载荷默认为复制本次合成结果；'
        '载荷不允许是工具。5 级及以下可免费领取，高阶物品可通过广告解锁。气泡倒计时只在局内递减，离线暂停，过期未领取时补偿 1 级体力瓶。'
    )
    pdf.write_code_block([
        'onBoardMerged(resultId, resultCell):',
        '  if globalLevel < 3 or activeBubbles >= 4: return',
        '  rule = matchHighestPriorityRule(resultId)',
        '  if random() < rule.baseChance * chanceMultiplier:',
        '      bubble = { payloadItemId: resultId, durationSec: 180, anchorCellIndex: resultCell }',
        '      MergeCompanionManager.addFloatBubble(bubble)',
        '',
        'updateBubble(dt):',
        '  bubble.expireRemainingSec -= dt',
        '  if expired: BoardManager.placeOrQueueReward(\"currency_stamina_1\")',
    ])

    pdf.write_h2('3.4 订单与客人模块')
    pdf.write_body(
        '订单模块根据玩家等级、棋盘物品链和当前进度生成客人需求。玩家提交指定物品后，系统发放金币、经验、星星、钻石、装饰或其他奖励，'
        '并刷新下一批订单。客人状态与订单队列独立保存，读档后重新绑定棋盘物品。'
    )
    pdf.write_body(
        '订单模块采用“订单模板 + 当前等级 + 棋盘物品可达性”的生成策略。系统会根据当前玩家进度选择可完成或接近可完成的物品，'
        '避免早期生成过高等级目标。订单完成时先检查玩家棋盘或仓库中是否存在所需 itemId，再扣除物品并发放奖励。'
    )
    pdf.write_code_block([
        'completeOrder(order):',
        '  for requirement in order.items:',
        '      assert BoardManager.hasItem(requirement.itemId, requirement.count)',
        '  BoardManager.consumeItems(order.items)',
        '  CurrencyManager.add(order.rewards)',
        '  CustomerManager.refreshOrder(order.id)',
        '  QuestManager.onOrderCompleted(order)',
        '  SaveManager.saveNow()',
    ])
    p, c = img('order')
    pdf.write_image(p, c)

    pdf.write_h2('3.5 订单定价、档位与扩展设计')
    pdf.write_body(
        '订单系统采用“档位模板 + 已解锁产线 + 工具等级上限 + 定价曲线”的设计。订单档位分为 C、B、A、S 四档，'
        '每档定义需求槽数、可选产线和等级范围。生成时系统根据玩家等级、棋盘上最高工具等级、已解锁绿植/花束/饮品线计算档位权重，'
        '早期主要刷 C/B 单，中期提高 A 单，4 级后才少量引入 S 单。'
    )
    pdf.write_table(
        ['档位', '槽位数', '需求范围', '设计目的'],
        [
            ['C 初级', '1-2', '鲜花 1-3 级', '新手阶段保证可完成，建立订单交付循环'],
            ['B 中级', '2', '鲜花/花束/部分饮品 2-5 级', '开始引入多槽订单和新产线'],
            ['A 高级', '2', '花系/饮品 3-7 级', '要求玩家调度工具、仓库和合成链'],
            ['S 特级', '2-3', '高等级花束、绿植、饮品', '低概率高价值订单，提供长期目标'],
        ],
        [28, 24, 58, 55],
    )
    pdf.write_body(
        '订单生成还包含饮品槽回退、绿植保底、组合单和限时钻石单扩展。饮品需求只有当对应饮品工具已存在时才会进入候选池，'
        '避免玩家只解锁蝴蝶线却刷出冷饮/甜品订单。绿植刚解锁后，系统会在有限次数内提升含绿植订单的权重，让新产线尽快被感知。'
    )
    p, c = img('drink_items')
    pdf.write_image(p, c)
    pdf.write_code_block([
        'generateOrder(playerLevel, unlockedLines):',
        '  weights = getOrderTierWeights(playerLevel, unlockedLines)',
        '  tier = pickTierByWeight(weights)',
        '  pool = resolveDemandPool(tier, unlockedLines)',
        '  for each slot:',
        '      demandDef = pick(pool)',
        '      eligibleLines = filterByUnlockedTool(demandDef.lines)',
        '      level = pickLevel(min, tierMax, toolCap, lineMax)',
        '      itemId = findItemId(category, line, level)',
        '  price = computeOrderHuayuan(slots)',
    ])
    pdf.write_body(
        '定价系统不是简单按等级固定值，而是每条产品线有独立曲线。鲜花作为基准，花束因存在包装中间品和额外体力成本而基准更高，'
        '绿植中后期略高于鲜花；冷饮因高阶直出少，后段合成压力较大；甜品与蝴蝶线按产出稀有度分别调参。'
        '多槽订单在单价之和基础上增加 16%/槽的调度补偿；组合单和挑战单再乘 1.06 的额外系数。'
        '棋盘出售价格仅为订单价值约 15%，用于腾格但不鼓励卖物品替代订单。'
    )
    pdf.write_code_block([
        'deliverHuayuanForItem(line, level):',
        '  curve = ORDER_DELIVERY_CURVES[category][line]',
        '  return round(curve.base * curve.growth ** (level - 1))',
        '',
        'computeOrderHuayuan(slots):',
        '  base = sum(slot.item.orderHuayuan)',
        '  multiSlotBonus = 1 + (slotCount - 1) * 0.16',
        '  if orderType == challenge: multiSlotBonus *= 1.06',
        '  return round(base * multiSlotBonus)',
    ])

    pdf.write_h2('3.6 经济与奖励模块')
    pdf.write_body(
        '经济模块统一管理金币、钻石、体力、星星、等级和经验值。奖励来源包括订单、签到、任务、挑战、活动、宝箱、升级礼包和换装升星。'
        '所有资源变化通过对应管理器导出状态并进入存档白名单。'
    )
    pdf.write_table(
        ['资源类型', '用途'],
        [
            ['金币', '订单基础收益、部分消耗与成长反馈'],
            ['钻石', '稀有奖励、补充资源或活动奖励'],
            ['星星', '装修和店铺成长相关解锁'],
            ['体力', '合成与局内操作消耗'],
            ['经验/等级', '推进系统开放、升级奖励和家具解锁'],
        ],
        [45, 120],
    )
    pdf.write_body(
        '经济系统将资源变动集中在 CurrencyManager 中处理，其他模块不直接修改数值字段。每次资源变化都通过 add、consume、canAfford 等接口完成，'
        '便于统一处理负数保护、显示刷新、任务统计和存档标记。奖励对象采用通用结构，可以由订单、签到、任务、活动、升级等多个来源复用。'
    )
    pdf.write_code_block([
        'grantRewards(rewards, source):',
        '  for reward in rewards:',
        '      switch reward.type:',
        '          case gold: CurrencyManager.addGold(reward.amount)',
        '          case diamond: CurrencyManager.addDiamond(reward.amount)',
        '          case star: CurrencyManager.addStar(reward.amount)',
        '          case item: BoardManager.enqueueRewardItem(reward.itemId)',
        '  EventBus.emit(\"reward:granted\", { source, rewards })',
    ])

    pdf.write_h2('3.7 装修与房间布局模块')
    pdf.write_body(
        '装修模块管理花店房间、家具配置、风格主题、摆放状态和已解锁状态。DecorationManager 负责数据读写，'
        'RoomLayoutManager 负责房间布局持久化，DecorationPanel 负责列表、选中、预览和应用。'
    )
    pdf.write_body(
        '装修数据分为“家具拥有状态”和“房间摆放状态”两层。家具拥有状态记录某个 furnitureId 是否解锁、数量和来源；'
        '房间摆放状态记录坐标、缩放、层级、翻转等渲染信息。这样的拆分可以支持同一个家具在多个房间或不同布局中复用。'
    )
    pdf.write_code_block([
        'placeFurniture(furnitureId, position):',
        '  if !DecorationManager.isUnlocked(furnitureId): return false',
        '  layout.items.push({ furnitureId, x, y, scale, layer, flipped })',
        '  RoomLayoutManager.save(layout)',
        '',
        'applyRoomStyle(styleId):',
        '  room.background = style.background',
        '  room.defaultFurniture = style.defaultFurniture',
        '  PersistService.writeJSON(\"huahua_room_layout\", room)',
    ])
    pdf.write_image_row(imgs('decoration'))

    pdf.write_h2('3.8 换装与角色展示模块')
    pdf.write_body(
        '换装模块管理店主服装、套装解锁、穿戴状态、升星礼包和角色展示纹理。DressUpPanel 提供换装界面，'
        'DressUpManager 保存已获得服装和当前穿戴套装。'
    )
    pdf.write_body(
        '换装模块采用 outfitId 作为唯一标识，表现层通过 TextureCache 根据 outfitId 映射到全身像和半身像纹理。'
        '穿戴操作只改变当前 outfitId，不复制图片资源；升星礼包、活动奖励或任务奖励只改变套装拥有状态，避免 UI 与数据重复维护。'
    )
    pdf.write_code_block([
        'equipOutfit(outfitId):',
        '  if !DressUpManager.hasOutfit(outfitId): return false',
        '  state.currentOutfitId = outfitId',
        '  ownerSprite.texture = TextureCache.getOwnerTexture(outfitId)',
        '  PersistService.writeJSON(\"huahua_dressup\", state)',
    ])
    p, c = img('dressup')
    pdf.write_image(p, c)

    pdf.write_h2('3.9 图鉴系统设计')
    pdf.write_body(
        '图鉴模块用于管理花卡发现、收集奖励、分页展示和收纳奖励。图鉴数据与订单、合成、活动系统解耦，'
        '每张卡以 cardId 记录发现状态、领取状态和展示资源。玩家获得新卡时写入 huahua_collection 或 huahua_flower_cards，'
        '重复卡可转化为花愿、钻石、体力或碎片类奖励。'
    )
    pdf.write_body(
        '图鉴界面采用分页壳体，页面内根据卡片状态显示未发现、已发现、可领取、已领取等不同视觉状态。'
        '该系统不直接改变棋盘，只通过奖励发放接口向经济系统或奖励箱派发奖励。'
    )
    pdf.write_code_block([
        'discoverCard(cardId):',
        '  entry = collection[cardId] or createDefaultEntry(cardId)',
        '  if !entry.discovered:',
        '      entry.discovered = true',
        '      entry.discoveredAt = now',
        '      PersistService.writeJSON(\"huahua_collection\", collection)',
        '',
        'claimCardReward(cardId):',
        '  assert entry.discovered and !entry.claimed',
        '  RewardManager.grant(entry.reward)',
        '  entry.claimed = true',
    ])
    p, c = img('collection')
    pdf.write_image(p, c)

    pdf.write_h2('3.10 签到系统设计')
    pdf.write_body(
        '签到系统采用 7 日循环 + 累计里程碑设计。玩家每天可领取一次固定奖励，1-6 天为钻石 10 + 体力 100，'
        '第 7 天为钻石 30 + 体力 100，并按周期附加专属家具。断签会重置连续签到天数，但累计签到天数保留，用于里程碑奖励。'
    )
    pdf.write_table(
        ['签到机制', '数据字段', '设计说明'],
        [
            ['每日签到', 'lastSignDate, signedToday', '用日期字符串判定当天是否已签，防止重复领取'],
            ['连续签到', 'consecutiveDays, signedDays', '用于 7 日循环展示；断签回到第 1 天'],
            ['累计里程碑', 'totalSignedDays, claimedMilestones', '8/15/22/28 天触发额外钻石或家具奖励'],
            ['广告加餐', 'checkInAdBonusClaimDate', '签到后可按日领取一次广告额外体力和钻石'],
        ],
        [36, 50, 79],
    )
    pdf.write_code_block([
        'claimCheckIn(today):',
        '  if state.lastSignDate == today: return alreadySigned',
        '  if yesterday(state.lastSignDate): state.consecutiveDays += 1',
        '  else: state.consecutiveDays = 1',
        '  cycleDay = ((state.consecutiveDays - 1) % 7) + 1',
        '  reward = getCheckInRewardForCycleDay(cycleDay, cycleIndex)',
        '  RewardManager.grant(reward)',
        '  state.totalSignedDays += 1',
        '  state.lastSignDate = today',
    ])
    p, c = img('checkin')
    pdf.write_image(p, c)
    p, c = img('levelup')
    pdf.write_image(p, c)

    pdf.write_h2('3.11 每日挑战与任务系统设计')
    pdf.write_body(
        '每日挑战系统与普通一次性任务不同，它按自然日生成任务集合，并将每日任务积分汇入周里程碑。'
        '任务类型包括收集花愿、完成合成次数、交付订单和消耗钻石。每个任务模板包含目标值、周积分和奖励，'
        '奖励可以是体力、钻石、棋盘物品、宝箱、幸运金币、万能水晶或许愿硬币。'
    )
    pdf.write_table(
        ['任务类型', '目标示例', '奖励设计'],
        [
            ['花愿任务', '收集 500 / 1500 / 3000 / 6000 花愿', '体力或钻石，鼓励完成订单与经营'],
            ['合成任务', '合成 50 / 100 / 300 / 500 次', '花材、绿植、宝箱、钻石袋'],
            ['订单任务', '完成 10 / 35 / 50 / 60 个订单', '体力、体力宝箱、钻石'],
            ['钻石任务', '消耗 5 / 10 / 20 / 50 钻石', '体力、体力宝箱、幸运金币'],
            ['周里程碑', '100-1550 周积分', '钻石、宝箱、幸运金币、万能水晶、许愿硬币'],
        ],
        [34, 66, 65],
    )
    pdf.write_code_block([
        'onProgressEvent(event):',
        '  for quest in dailyTasks:',
        '      if quest.kind == event.kind:',
        '          quest.current = min(quest.target, quest.current + event.value)',
        '          if quest.current >= quest.target: quest.completed = true',
        '',
        'claimDailyQuest(id):',
        '  grant(quest.reward)',
        '  weeklyPoints += quest.weeklyPoints',
        '  quest.claimed = true',
    ])
    p, c = img('daily')
    pdf.write_image(p, c)

    pdf.write_h2('3.12 大地图系统设计')
    pdf.write_body(
        '大地图系统用于承载多场景扩展和外部功能入口。地图内容宽度为 3 屏横向拼接，高度与设计分辨率保持 9:16。'
        '地图节点由 WorldMapConfig 配置，包含节点 id、类型、坐标、缩略图、解锁等级、目标 sceneId 或弹窗事件。'
        '节点类型包括当前花坊、可进入房屋、弹窗商店、锁定建筑和许愿喷泉等。'
    )
    pdf.write_table(
        ['节点', '类型', '解锁条件', '交互行为'],
        [
            ['花坊', 'current_house', '1 级', '进入当前花店场景'],
            ['许愿喷泉', 'gacha', '8 级', '打开许愿喷泉抽奖面板'],
            ['限时活动', 'gacha/event', '1 级', '打开活动面板'],
            ['蝴蝶小屋', 'house', '10 级', '进入蝴蝶主题装修场景'],
            ['蛋糕房/花园别墅', 'locked', '20/15 级', '展示未来场景入口和锁定态'],
        ],
        [38, 32, 35, 60],
    )
    pdf.write_code_block([
        'renderWorldMap():',
        '  draw map background with contentWidth = DESIGN_WIDTH * 3',
        '  for node in MAP_NODES:',
        '      locked = globalLevel < node.unlockLevel',
        '      sprite = TextureCache.get(node.thumbKey)',
        '      sprite.alpha = locked ? 0.68 : 1',
        '      onTap: if locked showUnlockToast() else dispatch(node.popupEvent or sceneId)',
    ])
    p, c = img('map')
    pdf.write_image(p, c)

    pdf.write_h2('3.13 许愿喷泉系统设计')
    pdf.write_body(
        '许愿喷泉是大地图上的抽奖玩法，消耗许愿硬币。单抽消耗 1 枚，十连消耗 10 枚。'
        '奖池由全量 ITEM_DEFS 自动生成，并按大类分桶控制概率：普通主物品约 44%，直接体力/钻石约 15%，'
        '宝箱/体力箱/钻石袋/红包约 20%，工具约 12%，金剪刀/万能水晶/幸运金币等高级道具约 9%。'
        '同一桶内按等级衰减，高级物品权重更低。'
    )
    pdf.write_table(
        ['奖池桶', '占比', '说明'],
        [
            ['主物品', '约 44%', '鲜花、饮品、棋盘货币块等，按等级平方衰减'],
            ['直接奖励', '约 15%', '体力和钻石多档直加'],
            ['宝箱组', '约 20%', '普通宝箱、体力宝箱、钻石袋、红包'],
            ['工具类', '约 12%', '各产线工具，桶内按等级衰减'],
            ['高级道具', '约 9%', '金剪刀、万能水晶、幸运金币等稀有物品'],
        ],
        [42, 28, 95],
    )
    pdf.write_code_block([
        'drawFlowerSign(count):',
        '  assert tickets >= count',
        '  tickets -= count',
        '  for i in 1..count:',
        '      entry = weightedPick(FLOWER_SIGN_GACHA_POOL)',
        '      if entry.kind == reward_box_item:',
        '          RewardBoxManager.enqueue(entry.itemId, entry.count)',
        '      else:',
        '          CurrencyManager.add(entry.amount)',
        '  PersistService.writeJSON(\"huahua_save\", SaveManager.exportState())',
    ])
    p, c = img('wish')
    pdf.write_image(p, c)

    pdf.write_h2('3.14 存档与云同步模块')
    pdf.write_body(
        '存档模块由 SaveManager 与 PersistService 协同完成。SaveManager 负责组装主存档；PersistService 负责读写本地 Storage、'
        '维护云同步白名单、生成云同步快照和 dirty 状态。CloudSyncManager 负责启动期拉取、数据合并、防抖上传、失败退避和切后台强制上传。'
    )
    pdf.write_body(
        '后端 huahua-api 提供 /login、/save/pull、/save/push 三类核心接口。登录后端根据平台 code 换取 openid，'
        '签发包含 userId、platform、gameKey 的 JWT。存档集合使用 huahua_playerData，并以 userId 进行平台隔离。'
    )
    pdf.write_body(
        '云同步流程设计为启动先拉取、游玩中防抖上传、切后台强制上传。客户端仅上传白名单 key 的字符串 payload，'
        '后端按 userId 查找单条文档并用 updatedAt 做版本校验。若本地版本落后，后端返回 STALE_UPDATE，客户端改为下行覆盖，防止旧设备回写。'
    )
    pdf.write_code_block([
        'scheduleSync(reason):',
        '  if !cloudReady: markPending',
        '  clearPreviousTimer()',
        '  setTimeout(() => pushSave(exportCloudSnapshot()), debounceMs)',
        '',
        'pushSave(snapshot):',
        '  POST /huahua-api/save/push Authorization: Bearer token',
        '  body = { schemaVersion, updatedAt, payload, clientFingerprint }',
    ])
    # =============== 四、数据结构设计 ===============
    pdf.write_h1('四、数据结构设计')
    pdf.write_h2('4.1 本地存档结构')
    pdf.write_code_block([
        'SaveData = {',
        '  fingerprint: string,',
        '  timestamp: number,',
        '  version: number,',
        '  currency: CurrencyState,',
        '  board: BoardState,',
        '  buildings?: BuildingPersistEntry[],',
        '  warehouse?: WarehouseState,',
        '  rewardBox?: RewardBoxState,',
        '  mergeCompanions?: MergeCompanionPersistState,',
        '  customers?: CustomerPersistState,',
        '  merchShop?: MerchShopPersistState,',
        '  flowerSignTickets?: number',
        '}',
    ])

    pdf.write_h2('4.2 云同步数据结构')
    pdf.write_code_block([
        'huahua_playerData = {',
        '  _id: string,',
        "  userId: 'wx:openid' | 'dy:openid' | 'tap:id' | 'anon:uuid',",
        "  platform: 'wx' | 'dy' | 'tap' | 'anon',",
        '  schemaVersion: number,',
        '  updatedAt: number,',
        '  clientFingerprint: string,',
        '  payload: Record<string, string>,',
        '  payloadKeys: string[],',
        '  lastWriteAt: number',
        '}',
    ])

    pdf.write_h2('4.3 云同步白名单')
    pdf.write_body(
        '只有白名单内的数据会打包上云，调试开关、token、匿名设备 id 等仅保留本地，避免上传无关信息。'
    )
    pdf.write_table(
        ['存储 key', '说明'],
        [
            ['huahua_save', '主存档，包含棋盘、货币、订单、建筑、仓库等'],
            ['huahua_checkin', '签到数据'],
            ['huahua_quests', '任务数据'],
            ['huahua_idle', '空闲收益数据'],
            ['huahua_tutorial', '新手引导状态'],
            ['huahua_decoration / huahua_room_layout', '装修与房间布局'],
            ['huahua_dressup', '换装状态'],
            ['huahua_collection / huahua_flower_cards', '图鉴与花卡收集'],
        ],
        [58, 107],
    )

    pdf.write_h2('4.4 订单与工具配置结构')
    pdf.write_body(
        '订单与工具配置是本软件可扩展性的核心。订单档位配置只描述“槽位范围、需求池、订单类型”，'
        '实际 itemId 由生成器结合玩家等级、已解锁产线和工具等级计算。工具配置只描述“工具等级、产出表、体力消耗、冷却和次数”，'
        '实际落子由棋盘管理器负责。'
    )
    pdf.write_code_block([
        'OrderTierDef = {',
        '  tier: C | B | A | S,',
        '  slotRange: [minSlots, maxSlots],',
        '  demandPool: CustomerDemandDef[],',
        '  timeLimit: number | null,',
        '  orderType: normal | timed | chain | challenge',
        '}',
        '',
        'ToolDef = {',
        '  itemId, toolLine, level, canProduce,',
        '  produceOutcomes?: WeightedOutcome[],',
        '  produceTable: [level, weight][],',
        '  cooldown, producesBeforeCooldown, staminaCost,',
        '  exhaustAfterProduces?: number',
        '}',
    ])

    pdf.write_h2('4.5 花语泡泡与活动任务结构')
    pdf.write_code_block([
        'MergeCompanionFloatBubble = {',
        '  id: string, ruleId: string, anchorCellIndex: number,',
        '  boardX: number, boardY: number,',
        '  payloadItemId: string,',
        '  expireRemainingSec: number,',
        '  diamondPrice: number, dismissEnabled: boolean',
        '}',
        '',
        'DailyQuestTemplate = {',
        '  id: string,',
        '  kind: huayuan | merge | deliver | diamond,',
        '  target: number, weeklyPoints: number,',
        '  reward: { huayuan?, stamina?, diamond?, flowerSignTickets?, itemId? }',
        '}',
    ])

    pdf.write_h2('4.6 大地图与许愿池结构')
    pdf.write_code_block([
        'MapNodeDef = {',
        '  id: string, type: current_house | house | popup_shop | locked | gacha,',
        '  label: string, x: number, y: number, thumbKey: string,',
        '  unlockLevel: number, targetSceneId?: string, popupEvent?: string',
        '}',
        '',
        'FlowerSignPoolEntry =',
        '  { kind: reward_box_item, itemId, weight, count? }',
        '  | { kind: direct_stamina, weight, amount }',
        '  | { kind: direct_huayuan, weight, amount }',
        '  | { kind: direct_diamond, weight, amount }',
    ])

    # =============== 五、数据接口设计 ===============
    pdf.write_h1('五、数据接口设计')
    pdf.write_h2('5.1 本地存储接口')
    pdf.write_body(
        '本地存储通过 PlatformService 封装 wx.setStorageSync、wx.getStorageSync、wx.removeStorageSync 等接口。'
        'H5 环境则使用 localStorage 作为兼容实现。'
    )
    pdf.write_code_block([
        'PersistService.readRaw(key): string | null',
        'PersistService.writeRaw(key, value, options)',
        'PersistService.remove(key, options)',
        'PersistService.exportCloudSnapshot(): PersistSnapshot',
        'PersistService.importCloudSnapshot(snapshot)',
    ])

    pdf.write_h2('5.2 后端 HTTP 接口')
    pdf.write_table(
        ['接口', '方法', '功能'],
        [
            ['/huahua-api/login', 'POST', '平台登录、生成 userId、签发 JWT'],
            ['/huahua-api/save/pull', 'POST', '按当前 userId 拉取云端存档'],
            ['/huahua-api/save/push', 'POST', '上传云端存档，按 updatedAt 处理版本冲突'],
            ['/huahua-api/health', 'POST', '健康检查'],
        ],
        [55, 28, 82],
    )

    pdf.write_h2('5.3 账号隔离接口')
    pdf.write_body(
        '后端将不同平台账号映射为带前缀的 userId，例如 wx:openid、dy:openid、tap:userId、anon:uuid。'
        'JWT payload 中包含 sub、plt、gk 字段，用于校验用户、平台和游戏代号，防止跨游戏或跨平台串档。'
    )

    # =============== 六、出错处理设计 ===============
    pdf.write_h1('六、出错处理设计')
    pdf.write_h2('6.1 网络异常处理')
    pdf.write_body(
        '客户端请求后端时设置超时时间。登录、拉取、上传失败不会阻塞本地游玩，而是记录日志并继续使用本地存档。'
        'CloudSyncManager 对上传失败进行计数，并按指数退避延迟下一次同步；连续失败后进入低频重试模式。'
    )

    pdf.write_h2('6.2 数据冲突处理')
    pdf.write_body(
        '云端保存时检查 updatedAt。若服务端已有更新版本，则返回 STALE_UPDATE 和远端数据；客户端收到后下行覆盖本地，'
        '避免旧设备把新设备进度回写。'
    )

    pdf.write_h2('6.3 资源加载异常处理')
    pdf.write_body(
        'TextureCache 在加载分包和图片时输出详细 errMsg 与原始错误对象。缺失或失败的资源不会直接导致数据丢失，'
        '开发阶段可通过日志定位具体分包、路径或缓存问题。'
    )

    pdf.write_h2('6.4 存档异常处理')
    pdf.write_body(
        'SaveManager 读取本地存档时校验 fingerprint 和 version。棋盘结构变化时会清理不兼容旧档；物品配置变化时优先做软迁移，'
        '过滤无效物品而不是直接删除整份存档。'
    )

    # =============== 七、性能优化设计 ===============
    pdf.write_h1('七、性能优化设计')
    pdf.write_h2('7.1 分包与纹理缓存')
    pdf.write_body(
        '项目将角色、物品、装修、面板等资源放入不同分包，启动时按需加载，降低主包体积。TextureCache 对纹理进行集中缓存，'
        '减少重复加载和重复创建纹理对象。'
    )

    pdf.write_h2('7.2 存档防抖与写入优化')
    pdf.write_body(
        '本地存档使用同步写入，避免异步 setStorage 顺序不确定造成旧数据覆盖新数据。云同步采用 1.5 秒防抖，'
        '短时间内多次业务变化合并为一次上传，降低网络请求频率。切后台时使用 flushNow 立即上传，兼顾性能和可靠性。'
    )

    pdf.write_h2('7.3 UI 与动画优化')
    pdf.write_body(
        'UI 面板采用对象复用、容器分层和局部刷新方式，减少频繁创建销毁对象。动画、飞星、奖励反馈等由管理器统一调度，'
        '避免多个系统重复更新同类视觉元素。'
    )

    pdf.write_h2('7.4 后端负载优化')
    pdf.write_body(
        '后端接口仅保存白名单存档 payload，不上传无关本地数据；同时限制存档大小，默认 256KB。'
        '通过 userId 唯一索引定位用户存档，pull/push 均为单文档读写，适合小游戏高频轻量同步场景。'
    )

    pdf.write_h1('八、结论')
    pdf.write_body(
        f'{SOFTWARE_FULL_NAME} {SOFTWARE_VERSION}围绕休闲合成、花店经营、装修换装、图鉴收集和云存档同步建立了完整的软件架构。'
        '软件客户端、资源、存档和后端服务均按模块化方式设计，具备清晰的数据结构、接口边界和异常处理机制，'
        '满足软件著作权登记文档鉴别材料对技术说明的要求。'
    )


def validate_pdf():
    from pypdf import PdfReader
    reader = PdfReader(str(OUTPUT))
    return len(reader.pages)


def main():
    pdf = DocPDF()
    pdf.add_font('Songti', '', SONGTI_PATH)
    write_document(pdf)
    pdf.output(str(OUTPUT))
    pages = validate_pdf()

    print('=' * 60)
    print('  花花妙屋软著文档鉴别材料 PDF 生成报告')
    print('=' * 60)
    print(f'  软件名称:     {SOFTWARE_FULL_NAME} {SOFTWARE_VERSION}')
    print(f'  申请人:       {APPLICANT_NAME}')
    print(f'  项目路径:     {PROJECT_ROOT}')
    print(f'  文档类型:     设计说明书')
    print(f'  生成页数:     {pages} 页')
    print(f'  输出文件:     {OUTPUT}')
    if pdf.missing_images:
        print('  缺少截图:     以下图片已在 PDF 中使用占位框')
        for path, caption in pdf.missing_images:
            print(f'    - {Path(path).name}: {caption}')
    else:
        print('  截图检查:     已找到全部截图')
    print('=' * 60)


if __name__ == '__main__':
    main()
