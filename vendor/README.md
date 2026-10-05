# vendor

免打包專案直接引用的第三方函式庫，由 `index.html` 的 import map 對應：

| 模組名稱 | 檔案 | 版本 | 授權 |
| --- | --- | --- | --- |
| `three` | `three/three.module.js`（會再載入 `three.core.js`） | 0.186.1 | MIT |
| `three/addons/` | `three/addons/`（GLTFLoader、SkeletonUtils、BufferGeometryUtils） | 0.186.1 | MIT |
| `lil-gui` | `lil-gui/lil-gui.esm.min.js` | 0.20.0 | MIT |

要升級版本時，從官方套件的 `build/` 與 `examples/jsm/` 複製同名檔案覆蓋即可。
