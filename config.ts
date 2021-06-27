const FIREBASE_TOKEN = "FIREBASE_TOKEN";
const FIREBASE_DATABASE = "FIREBASE_DATABASE";
const FIREBASE_PROJECT_ID = "FIREBASE_PROJECT_ID";
const FIREBASE_PROJECT_KEY = "FIREBASE_PROJECT_KEY";

export const projectID = Deno.env.get(FIREBASE_PROJECT_ID) ?? "";
export const projectkey = Deno.env.get(FIREBASE_PROJECT_KEY) ?? "";

let backgroundRefetchStarted = false;

const config = {
  firebaseDb: Deno.env.get("FIREBASE_DATABASE") ?? "(default)",
  host: `https://firestore.googleapis.com/v1/projects/${projectID}`,
  get token() {
    return this.storedToken?.id_token ?? Deno.env.get(FIREBASE_TOKEN);
  },
  get storedToken() {
    try {
      const file = Deno.readTextFileSync("./firebase_auth_token.json");

      return file ? JSON.parse(file) : null;
    } catch (e) {
      console.error(e);
    }
  },
};

const setProjectID = (id: string) => {
  Deno.env.set(FIREBASE_PROJECT_ID, id);
};

const setToken = (token: string) => {
  Deno.env.set(FIREBASE_TOKEN, token);
  Deno.writeTextFileSync(
    "./firebase_auth_token.json",
    JSON.stringify({ id_token: token })
  );
};

const setDatabase = (db: string) => {
  Deno.env.set(FIREBASE_DATABASE, db);
};

/*
 * Login with your IAM account to establish user.
 * Required GoogleService-Info.plist
 */
const setTokenFromServiceAccount = async () => {
  const p = Deno.run({
    cmd: ["gcloud", "auth", "application-default", "print-access-token"],
    stdout: "piped",
    stderr: "piped",
    stdin: "piped",
  });

  const output = new TextDecoder().decode(await p.output());

  await p.close();

  const token = String(output).replace(/\\n/gm, "\n").replace("\n", "");

  setToken(token);

  return token;
};

/*
 * Login with your email and password to establish iam user
 */
const setTokenFromEmailPassword = async (
  params?: {
    email?: string;
    password?: string;
    refreshToken?: string;
  },
  refresh: boolean = false
) => {
  const { email, refreshToken, password } = params ?? {};

  let baseUrl = "";
  let body = {};

  if (typeof refreshToken !== "undefined") {
    baseUrl = "securetoken.googleapis.com/v1/token";
    body = {
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    };
  } else {
    baseUrl = "identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";
    body = {
      email: email ?? Deno.env.get("FIREBASE_AUTH_EMAIL"),
      password: password ?? Deno.env.get("FIREBASE_AUTH_PASSWORD"),
      returnSecureToken: true,
    };
  }

  const firebase = await fetch(`https://${baseUrl}?key=${projectkey}`, {
    headers: {
      contentType: "application/json",
    },
    method: "POST",
    body: JSON.stringify(body),
  });

  const json = await firebase.json();

  const token = json?.idToken;

  token && setToken(token);

  if (refresh) {
    setRefetchBeforeExp({
      expiresIn: json.expiresIn,
      refreshToken: json.refreshToken,
    });
  }

  return token;
};

type Token = {
  expiresIn: number;
  refreshToken: string;
};

// TODO: GET PID ACCESS TO VAR FOR HARD STOP
const setRefetchBeforeExp = ({ expiresIn, refreshToken }: Token) => {
  const expMS = (expiresIn / 60) * 60000;

  if (!backgroundRefetchStarted) {
    Deno.run({
      cmd: [
        "deno",
        "run",
        "--allow-read",
        "--allow-env",
        "--unstable",
        "--allow-net",
        "--allow-run",
        "--allow-write",
        "./refresh.ts",
        String(expMS),
        refreshToken,
      ],
    });
  }
  backgroundRefetchStarted = true;
};

export {
  config,
  setToken,
  setDatabase,
  setProjectID,
  setRefetchBeforeExp,
  setTokenFromServiceAccount,
  setTokenFromEmailPassword,
};
