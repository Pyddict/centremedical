import { Auth0Client } from "@auth0/nextjs-auth0/server";

let client: Auth0Client | undefined;

// Initialisation paresseuse : évite d'exiger les variables d'environnement
// Auth0 au moment du build (elles ne sont nécessaires qu'à l'exécution).
export function auth0(): Auth0Client {
  if (!client) {
    client = new Auth0Client({
      authorizationParameters: { scope: "openid profile email" },
    });
  }
  return client;
}
