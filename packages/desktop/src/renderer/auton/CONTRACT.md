# desktop-auton-entry

一页以内。只写类型与测试表达不了的三样：模块存在的意图、不变量、与其它模块的交集在哪个 hook 点处理。

Intención: el renderer de escritorio necesita una entrada que monte la superficie
de Auton sin pasar por los servicios de ZCode.

Invariantes:

- El montaje vive en `mountAutonSpace` (módulo `ui-auton`); este módulo solo lo invoca.
- No crea servicios, ni abre puertos, ni toca el shell de ZCode.
- Se monta una sola vez sobre `#root`.
