# Selling the apps with real keys and downloads (Polar)

The site is ready for this. Until you add your links it stays in demo mode (the basket makes fake orders on the
visitor's own device and no payment is taken). Nothing here is switched on until you paste your own links in.

> Polar is the platform I recommended. Check its current fees, supported countries and how it handles UK VAT on its
> own pages before you sign up. If you pick a different platform (e.g. Lemon Squeezy), steps 1-5 are the same idea.

## 1. Set up Polar (you do this)
1. Create an account at polar.sh and set up your organisation (payouts go to your UK bank via its payment partner).
2. Create a product for each app, one-time price:
   - **B-Box Lighting Desk** - £99
   - **B-Box Android** - £19.99
3. On each product add two **benefits**:
   - **License key** - choose how many devices one key may be activated on (e.g. 2 or 3).
   - **File downloads** - upload the installer (Lighting Desk) or the app file (Android).
4. For each product create a **checkout link** and copy it.
5. Copy your **customer portal** link (where buyers see their keys and downloads) and your **organisation ID**.

## 2. Paste the links into the site
Open [js/app.js](js/app.js):

```js
const CONFIG = {
  ...
  demoCheckout: false,                      // <- set to false when you go live
  portalUrl: 'https://...your portal link...'
};
```

and in the `PRODUCTS` list, fill in `checkoutUrl` for **bbox-desk-app** and **bbox-android**.

What changes:
- Those two apps show **Buy now**, which opens Polar's checkout.
- With `demoCheckout: false` the basket disappears, and anything without a checkout link (the B-Box DMX and CRMX
  hardware, for now) shows **Enquire to order**, which opens the contact form with the product filled in.
- The Account page gets a **Find my licence keys and downloads** button, and the demo licence/order lists are hidden.

Then ask me to rebuild the `publish` folder and upload it again.

## 3. Make the apps check the key (needs the app code)
Buying a key does nothing unless each app asks Polar whether it's valid. Polar's API does this:
- Validate: `POST https://api.polar.sh/v1/customer-portal/license-keys/validate` with the `key` and your `organization_id`.
- Activate (only if you set a device limit): `POST https://api.polar.sh/v1/customer-portal/license-keys/activate`
  with `key`, `organization_id` and a `label` such as the device name.

Check Polar's docs for the current details, including which version of the endpoints suits an app that runs on the
customer's own device: <https://polar.sh/docs/features/benefits/license-keys>

This part has to be added inside the Lighting Desk and Android apps themselves. I don't have their source code.

## 4. Before you go live
- Do a real test purchase and check the key arrives, the download works and the key unlocks the app.
- Check the refund and VAT settings in Polar match what you intend.
- Google Play: if the Android app is on Google Play, Google generally requires its own billing for unlocking
  features. Selling the app file directly from your site avoids that.
