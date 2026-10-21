# FORMA installation

FORMA is delivered as an installable web application (PWA), not an APK or store listing. The same installation covers personal FORMA and the authorized Gestão workspace. App shortcuts do not grant roles: the existing server authorization remains required. Google login configuration and database records are unchanged.

## Delivered
- Stable app identity /, start URL /, scope /, standalone window and general FORMA name.
- Raster icons at 192/512px for installation and 180px for Apple touch icon. They are format/size conversions of the exact embedded original seal, not a generated or redesigned logo. scripts/build-install-icons.py reproduces them.
- Shared installation entry on login/personal header and Gestão header. One canonical native prompt handler replaces the old banner and handlers. The native prompt appears only when the browser supplies an eligible installation event. Otherwise explicit device/browser instructions are shown.
- iPhone/iPad: Safari → Share → Add to Home Screen; enable Open as Web App if offered. Desktop: native install option in compatible Chrome/Edge, or Add to Dock in compatible Safari. Browser policies, private browsing and embedded browsers can affect availability; the app never fabricates a native prompt.
- Network-only service worker: handles only same-origin GET document navigation. All API calls, POST/financial writes and third-party requests are untouched. It never uses Cache Storage, IndexedDB, a sync queue or cached authenticated pages. Offline navigation shows a generic retry page without records or OAuth query parameters. No forced reload on update, preserving ongoing forms.
- Registration uses updateViaCache:none; deployment responses remain no-store. Closing/reopening or refreshing gets the latest published HTML/assets. This is not background hot replacement of an already-open form.

## User test
1. Visit https://forma-fin.vercel.app/ in the device's normal browser and press Instalar.
2. Complete the browser's installation instructions and open the resulting FORMA icon.
3. Sign in with the same FORMÁ account if needed. Some installed browser environments have separate session storage; being asked to sign in is not deletion of server data.
4. Check the existing records and permitted modules; a student must still have no staff access.
5. Close and reopen after an update. Confirm it fetches the latest app without installing a new APK.
6. With internet disabled, a newly opened app must show the generic offline page and not claim records were saved. Reconnect and retry. This release does not offer offline financial operation.

## Validation and limits
Manifest routes/icon PNG dimensions, one prompt owner, native consent/cancel/accepted/install events, iOS guidance and standalone detection were checked. Service worker tests cover API/write bypass, fresh network use and privacy of offline responses. Full demo boot and the existing security checks passed. Actual OS installation, device-specific Google OAuth and add-to-home-screen menus require device acceptance testing; no claim of App Store/Play Store publication or native APK delivery is made.

Official references consulted:
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27
