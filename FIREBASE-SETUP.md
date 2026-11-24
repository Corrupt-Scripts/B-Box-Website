# Turning on shared calculators (Firebase setup)

Until you do this, the site runs in **demo mode**: sign-in is stored in each visitor's own browser and
calculators can't be shared. Setup takes about 10 minutes and the free plan is plenty for a small team.

## 1. Create the project
1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. **Add project** → name it (e.g. `bbox-website`) → you can switch Google Analytics off.

## 2. Turn on sign-in
**Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**

## 3. Create the database
1. **Build → Firestore Database → Create database.**
2. Pick a location close to your users (e.g. `europe-west2` London). Start in **production mode**.
3. Open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules), and **Publish**.

## 4. Register the website and copy its settings
1. Project settings (cog icon) → **Your apps** → web icon `</>` → name it → **Register app**.
2. Copy the `firebaseConfig` values into [`js/firebase-config.js`](js/firebase-config.js):

```js
window.BBOX_FIREBASE_CONFIG = {
  apiKey: '…',
  authDomain: '…firebaseapp.com',
  projectId: '…',
  appId: '…'
};
```
These values are not secrets — your data is protected by the rules in step 3, not by hiding the config.

## 5. Allow your domain
**Authentication → Settings → Authorized domains → Add domain** and add the domain the site will live on
(`localhost` is already allowed for testing on your own computer).

## 6. Test it with two people
1. Open the site, **Account → Create account**, then go to **Products → DMX calculator**.
2. Press **Share with others** → **Create and invite**, and copy the invite link.
3. Open the link in a different browser (or a private window), create a second account, press **Join and open**.
4. Add a fixture in one window — it should appear in the other within a second or two.
5. In the first window, **People → Remove** the second person: their calculator should drop back to their own.

## How it works
- **Your own calculator** is unchanged: it lives on the device, works offline, and is never uploaded unless you share it.
- **Sharing** creates a separate shared copy. The owner can start it from what's already on their device.
  Fixtures, rigs, the saved list, notes, photos and the rig being edited all sync live.
- **Invite links** let anyone who signs in edit that shared calculator. **People → Remove** removes a person, and
  **Switch off all invite links** stops new people joining (people already in stay in).
- Photos are compressed and stored inside the database, so you don't need Firebase Storage or a paid plan.
  Free-plan limits (1 GiB stored, 50k reads a day) are generous for rigs and photos, but check the Firebase console if usage grows.
- If two people edit the **same** fixture, rig or the rig being edited at the same moment, the last save wins.
  Different items never overwrite each other.
- The Android app and the standalone web app are untouched — sharing only exists on this website.

## Known limits
- Orders and licence keys on the Account page are still demo data (they live in the browser, not Firebase). Checkout needs a payment provider before you take real orders.
- There's no "delete shared calculator" button yet (data stays in Firestore until you delete it in the Firebase console).
- The Firebase scripts load from Google's servers (`gstatic.com`), so sharing needs an internet connection.
- The shared calculator was tested end to end here against a stand-in back end, **not** against a live Firebase project, so please run the two-person test above before you rely on it.
