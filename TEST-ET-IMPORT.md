# Pop Design 2.0 — test local, backend et import dashboard

Template Onirtech **`pop-design`** (stack React, SDK `@onirtech/template-sdk` **0.2.0**),
port du design Tooplate « 2097 Pop » enrichi en **chatbot réellement paramétrable**.

- Version du template : **2.0.0**
- 40 paramètres publics, 8 capacités hôte, aucune requête réseau depuis le template.
- Tous les éléments visuels (en-tête, tuiles, panneaux, galerie, chat, formulaire,
  pied de page) sont pilotés par des modèles et des paramètres.

---

## 1. Test local (harness MOCK)

### Lancer le serveur

```powershell
cd D:\template-onirtech\2097_pop\pop-design
npm run dev
```

Ouvrez **http://localhost:4500**.

> `npm run dev` lance le harness mock (port 4500) **et** Vite en mode watch.
> Pas de HMR : après une modification dans `src/`, rechargez la page (F5).
> Le harness ne contacte aucun backend : toutes les actions sont simulées.
> Arrêt : `Ctrl + C`.

### Checklist navigateur

1. **Identité** — nom, email, champs du `modelForm` et consentement ; l'envoi
   bascule sur le chat avec un message d'accueil personnalisé.
2. **Chat** — envoyez un message : indicateur de saisie (~700 ms), réponse
   Markdown (gras, italique, listes, liens, bloc de code, citation).
3. **Clavier** — `Entrée` envoie, `Maj+Entrée` ajoute une ligne
   (inversible avec le paramètre `entree_envoyer`).
4. **Suggestions** — 4 suggestions au départ ; elles disparaissent après le
   premier message du visiteur.
5. **Pièces jointes** — trombone → fichier → puce en attente → envoi ; la pièce
   apparaît dans le message.
6. **Tuiles** — les 4 tuiles Pop ouvrent leurs panneaux (Bienvenue, Équipe,
   Réalisations, Contact) ; fermeture par croix, fond ou `Échap`.
7. **Galerie** — photos du lien en scroll horizontal, clic → `openMedia`.
8. **Panneau Contact** — le message saisi part dans la discussion et ferme le panneau.
9. **Thème** — l'accent suit `theme.primary` du hôte tant que `couleur_accent`
   reste à sa valeur par défaut.
10. **Paramètres live** — dans la console :
    ```js
    const { ctx, render } = window.__mock;
    ctx.params.titre = "Mon titre";
    ctx.params.design_json = '{"accent":"#ff0055","rayon":9}';
    ctx.params.tuiles_json = JSON.stringify([
      { id: "faq", type: "text", libelle: "FAQ", titre: "Questions", texte: "**Réponse**" }
    ]);
    render();
    ```
11. **Menu de secours** — ouvrez **http://localhost:4500/?phase=chat&fallback=1** :
    les questions du menu sont rendues par le template, pas par le hôte.
12. **Console / réseau** — aucune erreur JS, aucune requête sortante
    (`favicon.ico` 404 = normal, c'est le harness).

### Vérifications automatisées

| Commande | Rôle |
|---|---|
| `npm test` | 65 tests Vitest (core + rendu) |
| `npm run check:browser` | 14 contrôles Puppeteer (le serveur dev doit tourner) |
| `npm run build` | build de production → `dist/index.js` (~1,2 Mo, ~691 Ko gzip) |
| `npm run validate` | validation du manifest (`✓ pop-design@2.0.0 valide`) |
| `npm run pack` | archive importable → `release/` |
| `npm run check:backend` | smoke test du **vrai** backend (session, Gemini, état, secours, messages) |

---

## 2. Vérifier le vrai backend

```powershell
npm run check:backend
```

Le script :

1. retrouve le lien de chat actif (par défaut le plus récent) ;
2. déchiffre `chat_links.token_enc` depuis les conteneurs de dev
   (`onir-cms-dev-app-1` + `onir-cms-dev-db-1`) ;
3. appelle `POST /api/chat/session`, `POST /api/chat`, `POST /api/chat/state`,
   `POST /api/chat/fallback` (menu + sélection) et `GET /api/chat/messages`.

Options utiles :

```powershell
# Jeton fourni explicitement (pas besoin de Docker)
node tools/backend-check.mjs --token <jeton> --base http://localhost:3000

# Choisir un lien par son libellé
node tools/backend-check.mjs --link-label "Collecte de prospects"

# Vérifier aussi « Terminer » (génère la fiche et le PDF)
node tools/backend-check.mjs --finish
```

Variables : `CHAT_LINK_TOKEN`, `CHAT_API_BASE`, `CHAT_LINK_LABEL`, `CHAT_TIMEOUT`,
`CMS_APP_CONTAINER`, `CMS_DB_CONTAINER`, `CMS_DB_USER`, `CMS_DB_NAME`.

> Le jeton n'est jamais affiché. Le script ne fait que des appels publics, comme
> le ferait un navigateur. Un menu de secours désactivé (404) est signalé comme
> « ignoré », pas comme une erreur.

---

## 3. Import dans le dashboard Onirtech

### Fichier à importer

```
D:\template-onirtech\2097_pop\pop-design\release\pop-design-2.0.0.onirtech-template
```

- ~1,3 Mo — c'est déjà une **archive zip** renommée : aucun zip à refaire.
- `release/` contient aussi `pop-design-2.0.0.release.json` (contrôle sha256),
  inutile pour l'import.

### Procédure

1. Dashboard Onirtech → panneau **Templates visuels**.
2. **Importer** (ou glisser-déposer) `pop-design-2.0.0.onirtech-template`.
3. Ouvrir le lien concerné et choisir **`pop-design`** dans le sélecteur.
4. Les 40 paramètres deviennent éditables dans l'éditeur.

> Si le sélecteur filtre sur `.zip`, renommez l'extension en
> `pop-design-2.0.0.zip` — le contenu est identique.

### Familles de paramètres

| Famille | Paramètres |
|---|---|
| Identité | `titre`, `sous_titre`, `logo_url`, `image_fond`, `image_soulignement` |
| Visuels | `image_welcome_1/2`, `image_equipe`, `avatar_assistant_url`, `avatar_utilisateur_url` |
| Couleurs & style | `couleur_accent`, `couleur_principale`, `couleur_texte`, `ambiance`, `densite`, `typographie`, `arrondi` |
| Panneaux | `titre_welcome`, `texte_welcome`, `titre_equipe`, `texte_equipe`, `titre_realisations`, `titre_contact`, `texte_contact` |
| Formulaire | `titre_identite`, `texte_identite` |
| Discussion | `placeholder_message`, `placeholder_contact`, `label_envoyer`, `label_terminer`, `message_vide`, `texte_bienvenue`, `suggestions`, `entree_envoyer` |
| Pied de page | `texte_footer`, `lien_footer`, `afficher_credit` |
| Avancé (JSON) | `design_json`, `tuiles_json`, `chat_json` |

### Capacités déclarées

`messages`, `media`, `modelForm`, `theme`, `userState`, `knowledge`, `fallback`,
`attachments`. Le template ne déclare **aucun réseau** (`network: []`) : le LLM,
les médias et les fichiers passent uniquement par les actions de l'hôte.

### Notes d'intégration

- **Contacts `modelForm`** : le backend n'accepte que `téléphone`, `whatsapp`,
  `site web` et `autre`. Le template mappe automatiquement un champ libre
  (« sujet », « budget »…) vers `autre` en conservant son libellé.
- **Menu de secours** : quand la capacité `fallback` est accordée, le template
  rend lui-même `ctx.state.fallback` ; le hôte ne superpose pas son panneau.
- **Pièces jointes** : nécessitent un champ `modelForm` de type `file` et la
  capacité `attachments`. `sendMessage` reçoit les identifiants en second
  argument uniquement lorsqu'il y a réellement une pièce jointe.
- **Images** : un paramètre `image` vide utilise le visuel embarqué ; seules les
  URL `http(s)`, `data:image/`, `blob:` et chemins relatifs sont acceptées.

### Après une modification du code

```powershell
npm test
npm run build
npm run validate
npm run pack
```

Puis réimporter l'archive dans le dashboard (remplace la version 2.0.0 ou
incrémente la version dans `package.json` et `src/manifest.ts`).

---

## 4. Structure du projet

| Fichier | Rôle |
|---|---|
| `src/PopDesign.jsx` | racine de composition et orchestration des actions hôte |
| `src/core/params.js` | source unique des 40 paramètres et lecteurs tolérants |
| `src/core/design.js` | presets, thème hôte et tokens CSS (`design_json`) |
| `src/core/element.js` | modèles OOP `VisualElement` / `TileModel` / `PanelModel` |
| `src/core/tiles.js` | normalisation de `tuiles_json` et création des panneaux |
| `src/core/chat.js` | configuration `chat_json`, messages, suggestions, contacts |
| `src/core/ui.js` | modèle d'interface consommé par les composants |
| `src/core/Markdown.jsx` | rendu Markdown sûr, sans `dangerouslySetInnerHTML` |
| `src/components/` | Header, Tiles, Panel, IdentityForm, Chat, Message, Composer… |
| `src/styles.css` | design Pop entièrement piloté par variables CSS |
| `src/manifest.ts` | manifest (40 params, 8 capacités, réseau vide) |
| `src/icons.js` | 43 glyphes FontAwesome (générés par `npm run icons`) |
| `tests/core.test.js` | tests des modèles et paramètres |
| `tests/template.test.jsx` | tests de rendu du web-component |
| `tools/browser-check.mjs` | contrôle navigateur Puppeteer |
| `tools/backend-check.mjs` | smoke test du backend réel |
| `harness/host.mjs` | hôte mock local (aucune connexion) |
| `onirtech.template.json` + `dist/` + `release/` | artefacts générés — ne pas éditer à la main |
