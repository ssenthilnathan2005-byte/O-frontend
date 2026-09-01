import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

export async function nativeGoogleSignIn(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("nativeGoogleSignIn should only be called on native platforms");
  }
  const result = await FirebaseAuthentication.signInWithGoogle({
    useCredentialManager: false,
  });
  const idToken = result.credential?.idToken;
  if (!idToken) {
    throw new Error("Google Sign-In failed: no ID token returned");
  }
  await FirebaseAuthentication.signOut();
  return idToken;
}
