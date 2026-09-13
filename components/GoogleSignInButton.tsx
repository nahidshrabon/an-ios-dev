"use client";

import { useCallback, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
            nonce?: string;
            use_fedcm_for_prompt?: boolean;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "small" | "medium" | "large";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill";
              width?: number;
            }
          ): void;
        };
      };
    };
  }
}

// Supabase verifies that the ID token's nonce matches, but expects the
// provider to have received it hashed — so Google gets the SHA-256 digest
// and signInWithIdToken gets the original.
async function generateNonce(): Promise<[raw: string, hashed: string]> {
  const raw = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  const hashed = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return [raw, hashed];
}

// Signs in with a Google ID token rather than the redirect flow used for
// GitHub. Google issues the token to this origin directly, so the handshake
// never passes through the Supabase project's domain — which is what Google
// would otherwise name on its consent screen.
export function GoogleSignInButton() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const container = containerRef.current;
    if (!clientId || !window.google || !container) return;

    const [nonce, hashedNonce] = await generateNonce();

    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
      callback: async ({ credential }) => {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: credential,
          nonce,
        });

        if (error) {
          setError(error.message);
          return;
        }

        router.push("/roadmap");
        router.refresh();
      },
    });

    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: 336,
    });
  }, [router]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onReady={() => void initialize()}
      />
      <div ref={containerRef} className="flex justify-center" />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}
