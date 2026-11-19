<img src="assets/icon.svg" width="64" height="64" alt="">

# Untrap for Instagram

A browser extension for using Instagram on the web without the home feed.

- **DMs.** Open conversations and use the message composer.
- **Stories.** Open the stories tray from Home.
- **Shared reels and posts.** Open individual items from a conversation.

The extension hides the home feed and keeps Home and Messages in the sidebar. Opening Explore or the Reels tab redirects to your inbox.

## Install in Helium

1. On GitHub, choose **Code** → **Download ZIP**, then extract the ZIP. You can also clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and select the folder that contains `manifest.json`.
4. Reload any open Instagram tabs.

The same steps apply to Chromium browsers that support unpacked extensions. After updating the files, reload the extension from its card and refresh Instagram.

## How it works

`src/content.js` runs on every Instagram page:

- **Navigation.** Home, DMs, stories, individual posts and reels, and account and sign-in pages are allowed. The extension rewrites `/reels/<id>` to `/reel/<id>` and redirects blocked pages to `/direct/inbox/`.
- **Home.** The extension uses the story rings to find the tray and hide adjacent feed content. Instagram's footer can still appear.
- **Posts and reels.** The extension tries to hide recommendations below the individual item.

`src/content.css` is a backup that hides sidebar items by link or icon label, in case Instagram changes its layout.

## If something breaks

Instagram changes its page structure often and uses scrambled class names, so this extension relies on page structure, links and icon labels instead. If something starts showing up again, or the stories tray disappears, open DevTools and see what changed. Then adjust `tidyHome` / `tidyNav` in `src/content.js`, or the selectors in `src/content.css`.

To get full Instagram back temporarily (for example, to edit your profile), switch the extension off in `chrome://extensions`.
