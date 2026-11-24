/* =========================================================
   Firebase settings — sign-in and shared (multi-person) calculators.
   Fill these in using FIREBASE-SETUP.md. Until projectId is set, the site
   runs in demo mode: sign-in is stored in the visitor's browser only and
   calculators cannot be shared.
   (These values are not secret. Security comes from firestore.rules.)
   ========================================================= */
window.BBOX_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDOq5JsRaJ6daXF4KNDtn0maiqwpe9zPsM',
  authDomain: 'b-box-c35d8.firebaseapp.com',
  projectId: 'b-box-c35d8',
  appId: '1:308116190647:web:d7be9664b1f1c1b2e8a432'
};

// Everything else waits on this promise: it resolves to the back end, or null when Firebase isn't set up.
window.BBoxFBReady = new Promise(function (resolve) { window.__bboxFBResolve = resolve; });
if (!window.BBOX_FIREBASE_CONFIG.projectId) window.__bboxFBResolve(null);
