# App Review Notes — draft only

Status: PREPARED. These instructions describe local game version 0.3.0 (R25). The existing native-kit project is still 1.0.1/build 2 and has NOT been rebuilt from this revision. Do not attach this note to the old binary as though it contains these changes.

No login, purchase, ad, or internet service is needed for gameplay when the assets are bundled. This is a single-player 3D butcher-shop defense game. Meat is both sale inventory and a consumable that changes enemies' targets. All players have access to the same features below.

## See the signature mechanic in under three minutes

1. On a fresh installation, select a keeper and press the confirmation button (「確認屠夫老闆娘」 for the default keeper).
2. The open brown tactical order card is 「鮮肉佈局」. Tap West (「西側攔截」), Center (「中央聚攏」), or East (「東側繞行」). The marker and overhead camera show the chosen area. Center is a useful first choice.
3. Tap 「領試守弩塔，依佈局開波」. This grants the permanent starter ballista once and starts the actual first campaign wave. It does not replace or reset an existing campaign.
4. The first free meat scrap is deployed when enemies begin spawning. Watch ordinary enemies turn toward the meat instead of the shop barrier. The overhead view lasts briefly, then returns to the keeper. Bosses ignore bait.
5. At least two attracted enemies complete the first tactical card; the collapsed card displays 「首張戰術單完成」. This result is saved locally. Let the ballista finish the wave to earn the first defense reward and, when eligible, the first patrol stamp.
6. Tap the gear button to pause. Open 「補給」 to inspect patrol rewards, then 「繼續遊戲」 to return. Close and reopen the app to confirm that campaign wave, money, towers, inventory and tactical-card progress remain.

For a returning campaign, open 「鮮肉佈局」 using its summary bar. With at least one tower and a wave remaining, 「依此佈局開波」 uses the chosen location. During a wave, 「投下鮮肉」 uses a scrap or real meat and respects the cooldown. The existing bait button also supports drag-to-aim and release-to-throw; dragging to the cancel area spends nothing.

After the starter encounter, the original handbook remains available for hunting, collecting meat, stocking the stall, serving customers and purchasing upgrades. This is a persistent game feature, not a review-only demo.

## Material changes and limits

R25 adds the playable three-location bait layout, starter-defense route, overhead observation, locally saved tactical objective and dedicated sound cues. It removes the external Google Fonts request and player-facing performance diagnostics. The elite-wave schedule was corrected with unchanged acceptance thresholds and fixed/fresh seed validation.

The application still shares broad survival and tower-defense conventions with existing games. We do not claim that using a different engine or having different file hashes alone resolves Guidelines 4.3 or 4.2.6. Standard third-party components and retained asset sources are listed in SHARED_ASSETS_AUDIT.md and CREDITS.md.

## Evidence required before responding to Apple's nine questions

1. Function: operate one butcher shop, allocate saleable meat to lures, actively defend fixed tower positions.
2. Audience: single-player action/management and spatial defense players; not a Kids Category submission.
3. Need/difference: a compact loop where trading away meat alters enemy destinations in the same shop economy; no unsupported worldwide exclusivity claim.
4. Beta feedback: **BLOCKED** — headless automated testing is not external beta feedback. Real tester observations, dates, consent and resulting changes must be supplied before making this claim.
5. Portfolio differentiation: see DIFFERENTIATION.md for each named app.
6. Consolidation: these mechanics have a separate economy, control scheme and campaign, but whether they should be consolidated is a product/account decision. No evidence of that decision is fabricated here.
7. Shared code/assets: exact tracked-runtime hash scan found no matches in the inspected repositories. Standard frameworks, system fonts, packaging and the comparison limits are documented.
8. Third-party content: Babylon.js, Vite and the specific licensed asset sources in CREDITS.md; the final native dependency inventory must be checked in the new archive.
9. Provider/submission relationship: **BLOCKED** — repo access does not prove the submitter is the content provider. The account owner must supply accurate ownership/customer/partner information.

Still required: rebuilt signed iOS/Android packages, physical-device recording and lifecycle checks, external beta feedback, final privacy-form readback and verified content-provider identity. Nothing has been uploaded, submitted or sent to Apple/Google in this round.
