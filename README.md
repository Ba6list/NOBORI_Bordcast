# NOBORI Broadcast Control

Overwatch大会「NOBORI」向けのOBSブラウザソース用Webツールです。

## URL

- 管理画面: `/`
- マップピック: `/obs/map`
- ロスター紹介: `/obs/roster`
- キャラクターBAN: `/obs/ban`

透過で使いたい場合は、OBS側URLに `?transparent=1` を付けます。

ローカル確認では起動時に表示される `http://localhost:3000/` や `http://localhost:3001/` に上記パスを付けて使います。

## Vercel

GitHubリポジトリをVercelにImportし、Framework PresetはNext.jsのままで公開できます。
`vercel.json` でVercel用ビルドは `pnpm exec next build` に固定しています。

## 同期

管理画面で変更した内容は `localStorage` と `BroadcastChannel` で同じ端末内のOBS表示へ即時反映されます。

## 画像差し替え

正式なNOBORIキービジュアル、チームロゴ、マップ画像、選手写真、ヒーロー画像は `public/assets` に置き、管理画面のURL欄で `/assets/file-name.png` のように指定してください。

現在のNOBORI配信トーン背景:

```text
/assets/nobori-stream-background.png
```

右上マーク:

```text
/assets/nobori-symbol.png
```

ロゴセット:

```text
/assets/nobori-full.png
/assets/nobori-typography.png
```
