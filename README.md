# NOBORI Broadcast Control

Overwatch大会「NOBORI」向けのOBSブラウザソース用Webツールです。

## URL

- 管理画面: `http://localhost:3000/`
- マップピック: `http://localhost:3000/obs/map`
- ロスター紹介: `http://localhost:3000/obs/roster`
- キャラクターBAN: `http://localhost:3000/obs/ban`

透過で使いたい場合は、OBS側URLに `?transparent=1` を付けます。

## 同期

管理画面で変更した内容は `localStorage` と `BroadcastChannel` で同じ端末内のOBS表示へ即時反映されます。

## 画像差し替え

正式なNOBORIキービジュアル、チームロゴ、マップ画像、選手写真、ヒーロー画像は `public/assets` に置き、管理画面のURL欄で `/assets/file-name.png` のように指定してください。

現在の仮背景:

```text
/assets/nobori-kv-placeholder.png
```
