装修底栏 UI 组件 — NB2 单独生成说明（不切原型图）

一、输出目录（仓库外）
  ../game_assets/huahua/assets/deco_room_bottom_ui/
  - 成品 PNG（抠底后）：与下表「输出文件名」一致
  - raw_nb2/：NB2 白底或品红底原图（可留档再加工）
  - inventory.txt：脚本跑完后自动生成清单

二、一键批量（推荐）
  仓库根目录：
    python3 scripts/gen_deco_bottom_ui_assets.py
  单张重跑：
    python3 scripts/gen_deco_bottom_ui_assets.py --only deco_bottom_ui_panel_shell
  仅对已生成的 raw 抠底裁边：
    python3 scripts/gen_deco_bottom_ui_assets.py --skip-generate

三、提示词与输出对应（均为 1:1，英文正文见各 *_nb2_prompt.txt）

  deco_bottom_ui_panel_shell_nb2_prompt.txt          -> deco_bottom_ui_panel_shell.png
  deco_bottom_ui_inner_mint_plate_nb2_prompt.txt       -> deco_bottom_ui_inner_mint_plate.png
  deco_bottom_ui_finish_button_nb2_prompt.txt          -> deco_bottom_ui_finish_button.png
  deco_bottom_ui_tab_pill_inactive_nb2_prompt.txt      -> deco_bottom_ui_tab_pill_inactive.png
  deco_bottom_ui_tab_pill_active_nb2_prompt.txt      -> deco_bottom_ui_tab_pill_active.png
  deco_bottom_ui_item_slot_frame_nb2_prompt.txt      -> deco_bottom_ui_item_slot_frame.png
  deco_bottom_ui_badge_placed_nb2_prompt.txt         -> deco_bottom_ui_badge_placed.png
  deco_bottom_ui_icon_check_white_nb2_prompt.txt       -> deco_bottom_ui_icon_check_white.png  （品红底，脚本内色键去底）
  deco_bottom_ui_icon_coin_bag_nb2_prompt.txt        -> deco_bottom_ui_icon_coin_bag.png
  deco_bottom_ui_icon_tab_greenhouse_nb2_prompt.txt  -> deco_bottom_ui_icon_tab_greenhouse.png
  deco_bottom_ui_icon_tab_furniture_nb2_prompt.txt   -> deco_bottom_ui_icon_tab_furniture.png
  deco_bottom_ui_icon_tab_appliance_nb2_prompt.txt   -> deco_bottom_ui_icon_tab_appliance.png
  deco_bottom_ui_icon_tab_ornament_nb2_prompt.txt    -> deco_bottom_ui_icon_tab_ornament.png
  deco_bottom_ui_icon_tab_wallart_nb2_prompt.txt     -> deco_bottom_ui_icon_tab_wallart.png
  deco_bottom_ui_icon_tab_garden_nb2_prompt.txt      -> deco_bottom_ui_icon_tab_garden.png

四、流程说明
  除「白色对号」外，成品均经 birefnet-general rembg + crop_trim。
  对号图标用 #FF00FF 品红底生成，避免与白底混消。

五、网络
  generate_images.py 默认会走本机 7897 代理；代理未开时会报错。
  直连 Google 可用时，批量脚本已默认设置 GEMINI_IMAGE_NO_PROXY=1（直连）。
  必须走代理时：export GEMINI_IMAGE_NO_PROXY=0 且先启动 Clash 等。
