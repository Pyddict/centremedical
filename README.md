# Centre Médical — Gestion RH

Application web interne de gestion RH pour le cabinet : congés, absences et présence,
demandes de matériel et commandes, coûts récurrents et fiches administratives des employés.

## Fonctionnalités

- **Authentification Auth0** — connexion sécurisée ; chaque employé est rattaché à son
  compte par son adresse email. Le premier utilisateur à se connecter devient
  automatiquement administrateur.
- **Rôles** — Administrateur, Médecin, Assistante. Un utilisateur peut cumuler plusieurs
  rôles (un médecin peut être administrateur). Les administrateurs ont accès à tout.
- **Stock & commandes** — les médecins déposent leurs demandes de matériel ; l'assistante
  voit la liste « à commander », regroupe les demandes en commande, puis à la réception
  valide la commande, enregistre le devis (fichier) et le montant, et la marque « à payer »
  puis « payée ».
- **Congés** — chaque employé (assistante notamment) fait sa demande de congés ; les
  administrateurs valident ou refusent. Le solde de jours restants est visible par
  l'employé et par les administrateurs.
- **Bon de congés PDF** — pour chaque congé validé, un bon récapitulatif au format PDF
  peut être téléchargé et envoyé au service de paie externalisé.
- **Absences & présence** — les médecins déclarent leurs vacances ; un calendrier mensuel
  affiche le nombre de personnes présentes chaque jour et signale **en rouge** les jours
  ouvrés sans aucun médecin présent (congés validés inclus dans le calcul).
- **Coûts récurrents** (administrateurs) — suivi des charges communes du cabinet :
  nettoyage, service de paie, comptabilité, informatique, loyer… avec totaux mensuels et
  annuels.
- **Fiches employés** (administrateurs) — fiche administrative dynamique et modifiable :
  prénom, nom, date de naissance, adresse, téléphone, email, n° de sécurité sociale,
  IBAN… chaque champ est copiable en un clic. Documents attachés (contrat d'embauche,
  carte d'identité…) stockés de façon privée et téléchargeables.

## Pile technique

| Élément          | Choix                                              |
| ---------------- | -------------------------------------------------- |
| Framework        | Next.js 15 (App Router, TypeScript)                |
| Base de données  | PostgreSQL + Prisma ORM (migrations versionnées)   |
| Authentification | Auth0 (`@auth0/nextjs-auth0`)                      |
| UI               | Tailwind CSS                                       |
| PDF              | `pdf-lib` (bons de congés)                         |
| Déploiement      | Docker + Docker Compose (app + PostgreSQL)         |

Les fichiers uploadés (devis, documents employés) sont stockés sur disque dans un volume
Docker (`uploads/`) et servis uniquement via des routes authentifiées — jamais en accès
public.

## Configuration Auth0

1. Créer une application **Regular Web Application** sur [manage.auth0.com](https://manage.auth0.com).
2. Dans les paramètres de l'application, renseigner :
   - **Allowed Callback URLs** : `https://votre-domaine/auth/callback`
     (et `http://localhost:3000/auth/callback` pour le dev)
   - **Allowed Logout URLs** : `https://votre-domaine` (et `http://localhost:3000`)
3. Reporter *Domain*, *Client ID* et *Client Secret* dans le fichier `.env`.
4. Générer la clé de session : `openssl rand -hex 32` → `AUTH0_SECRET`.

> **Important — sécurité.** Désactivez les inscriptions publiques dans Auth0
> (Authentication → Database → votre connexion → *Disable Sign Ups*) et créez vous-même
> les comptes des employés. Le rattachement d'un compte Auth0 à une fiche employé se fait
> par l'adresse email : l'application refuse les emails non vérifiés
> (`email_verified`), mais des inscriptions ouvertes resteraient une surface d'attaque
> inutile pour des données RH.

## Démarrage en développement

```bash
cp .env.example .env        # puis remplir les valeurs (Auth0, PostgreSQL)
npm install
npx prisma migrate deploy   # applique les migrations sur la base
npm run db:seed             # optionnel : SEED_DEMO=1 pour des données de démo
npm run dev                 # http://localhost:3000
```

Il faut une instance PostgreSQL accessible (par exemple `docker compose up -d db`).

## Déploiement sur le VPS (Docker)

```bash
git clone <ce dépôt> && cd centremedical
cp .env.example .env        # remplir les valeurs de production
docker compose up -d --build
```

Le conteneur applique automatiquement les migrations (`prisma migrate deploy`) au
démarrage, puis lance l'application sur le port `APP_PORT` (3000 par défaut).

### Changer le port

Si le port 3000 est déjà occupé sur le serveur, il suffit de changer `APP_PORT` dans le
fichier `.env` :

```bash
APP_PORT=8080
```

puis `docker compose up -d`. Seul le port côté machine hôte change ; le conteneur
continue d'écouter sur 3000 en interne, il n'y a rien d'autre à modifier dans le projet.
PostgreSQL n'est pas exposé sur l'hôte, il ne peut donc pas entrer en conflit.

Deux points à aligner sur le nouveau port **si vous accédez à l'application sans reverse
proxy** (en tapant `http://mon-serveur:8080` dans le navigateur) :

- `APP_BASE_URL=http://mon-serveur:8080` dans le `.env` ;
- les *Allowed Callback URLs* (`http://mon-serveur:8080/auth/callback`) et *Allowed
  Logout URLs* (`http://mon-serveur:8080`) de votre application Auth0.

Avec un reverse proxy en HTTPS, `APP_BASE_URL` et les URLs Auth0 restent ceux de votre
domaine public : seule la cible du proxy suit le nouveau port
(`reverse_proxy localhost:8080`).

En production, placez un reverse proxy (Caddy, Nginx, Traefik…) devant l'application
pour gérer le HTTPS — indispensable pour Auth0 et pour la confidentialité des données.
Exemple avec Caddy : `rh.moncentre.fr { reverse_proxy localhost:3000 }`.

### Premier démarrage

1. Ouvrez l'application et connectez-vous avec votre compte Auth0 : le **premier
   utilisateur connecté devient administrateur**.
2. Dans **Employés**, créez les fiches de vos collègues avec leur adresse email exacte
   et leurs rôles : ils pourront alors se connecter.
3. Configurez les soldes de congés (jours alloués par année) sur chaque fiche employé.

### Sauvegardes

Les données vivent dans deux volumes Docker : `pgdata` (base) et `uploads` (fichiers).
Exemple de sauvegarde de la base :

```bash
docker compose exec db pg_dump -U centremedical centremedical > backup_$(date +%F).sql
```

Pensez à sauvegarder aussi le volume `uploads` (devis et documents des employés).

## Structure du projet

```
app/
  (app)/            pages authentifiées (tableau de bord, stock, congés, absences, coûts, employés)
  api/              routes de téléchargement (PDF de congés, devis, documents)
  non-autorise/     page affichée quand l'email connecté n'est pas un employé
components/         composants UI partagés
lib/                auth0, prisma, session/rôles, dates, formats, uploads
prisma/             schéma, migrations, seed
scripts/            outils de build (préparation du CLI Prisma pour l'image Docker)
```

L'image Docker utilise la sortie « standalone » de Next.js et n'embarque que les
dépendances réellement nécessaires à l'exécution : elle pèse environ 570 Mo au lieu de
1,5 Go avec un `node_modules` complet.

## Pistes d'évolution (à discuter)

- Notifications par email (nouvelle demande de congés, commande reçue…)
- Récapitulatif PDF mensuel de tous les congés validés pour le service de paie
- Gestion des jours fériés français dans le décompte des congés
- Historique/audit des modifications des fiches employés
- Export comptable des coûts récurrents
