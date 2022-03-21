import { assertEquals, assertNotEquals } from "./test_deps.ts";
import { firestore } from "./firestore.ts";
import {
  FIREBASE_TOKEN,
  FIREBASE_REFRESH_RATE,
  setToken,
  setTokenFromServiceAccount,
  setTokenFromEmailPassword,
} from "./config.ts";

const body = {
  collection: "users",
  id: "L0xO1Yri80WlrFSw6KxqccHhKhv2",
};

const refreshRate = Number(Deno.env.get(FIREBASE_REFRESH_RATE || 1));

const t = await setTokenFromEmailPassword();

Deno.test({
  name: "firestore should get token from auth",
  fn: async () => {
    const tt = await setTokenFromEmailPassword();

    assertEquals(!!tt, true);
  },
});

Deno.test({
  name: "firestore should create a new item in collection",
  fn: async () => {
    const d = await firestore.createDocument({
      ...body,
      value: {
        firstname: { stringValue: "Jeff" },
        lastname: { stringValue: "Jeff" },
      },
    });
    if (d.error?.status === "ALREADY_EXISTS") {
      assertEquals(d.error.code, 409);
    } else {
      assertEquals(d.fields.lastname.stringValue, "Jeff");
    }
  },
});

Deno.test({
  name: "firestore should run and fetch document",
  fn: async () => {
    const d = await firestore.getDocument({ ...body });
    assertEquals(d.fields.firstname.stringValue, "Jeff");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "firestore should error",
  fn: async () => {
    const d = await firestore.getDocument({
      ...body,
      authorization: false,
    });
    assertEquals(d, {
      error: {
        code: 403,
        message: "Missing or insufficient permissions.",
        status: "PERMISSION_DENIED",
      },
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "firestore should invalidate admin account and error",
  fn: async () => {
    setToken("");
    const d = await firestore.getDocument({ ...body, authorization: false });
    assertEquals(d, {
      error: {
        code: 403,
        message: "Missing or insufficient permissions.",
        status: "PERMISSION_DENIED",
      },
    });
  },
});

Deno.test({
  name: "firestore should pass in token and fetch document",
  fn: async () => {
    setToken("");
    const d = await firestore.getDocument({ ...body, authorization: t });
    assertEquals(d.fields.lastname.stringValue, "Jeff");
    // reset token
    setToken(t);
    const dt = await firestore.getDocument({ ...body });
    assertEquals(dt.fields.lastname.stringValue, "Jeff");
  },
});

Deno.test({
  name: "firestore should get list from collection",
  fn: async () => {
    const d = await firestore.getDocument({ collection: "users" });
    assertEquals(d.documents.length, 1);
  },
});

Deno.test({
  name: "firestore should update item from collection",
  fn: async () => {
    const d = await firestore.updateDocument({
      ...body,
      value: {
        firstname: { stringValue: "Jeff" },
        lastname: { stringValue: "Jeff" },
      },
    });

    assertEquals(d.fields.lastname.stringValue, "Jeff");
  },
});

// Deno.test({
//   name: "firestore should begin and commit transaction",
//   fn: async () => {
//     const d = await firestore.beginTransaction({});
//     assertEquals(typeof d.id, "string");
//     const c = await firestore.commitTransaction({
//       ...body,
//       transaction: d.id,
//     });

//     assertEquals(typeof c.id, "string");
//   },
// });

Deno.test({
  name: "firestore should get token from service account",
  fn: async () => {
    if (Boolean(Deno.env.get("CI")) === true) {
      const d = await setTokenFromEmailPassword();
      const v = d.slice(0, 4);
      assertEquals(v, "eyJh");
    } else {
      const d = await setTokenFromServiceAccount();
      const v = d.slice(0, 4);
      assertEquals(v, "ya29");
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: `firestore should refresh token and set env in ${refreshRate}s`,
  fn: async () => {
    const t = await setTokenFromEmailPassword(undefined, true);
    assertEquals(t, Deno.env.get(FIREBASE_TOKEN));

    setTimeout(() => {
      assertNotEquals(t, Deno.env.get(FIREBASE_TOKEN));
      Deno.exit(0);
    }, refreshRate * 2000);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
