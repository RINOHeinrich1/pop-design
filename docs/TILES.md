# Tuiles et panneaux — logique d'alimentation

Les tuiles de gauche ne sont pas des images : ce sont des **descripteurs de
rubriques**. Chaque descripteur produit une tuile visible et, au clic, un
panneau.

## Chaîne de rendu

1. `tuiles_json` (paramètre statique, JSON) décrit la liste des tuiles.
2. `normalizeTiles(params)` lit le JSON, normalise `type` et `icone`, filtre
   `enabled`, applique le défaut et borne à 8 tuiles.
3. `createPanels(params, tiles)` exécute une stratégie par `type` et produit un
   `PanelModel` pour chaque tuile.
4. L'interface affiche la liste des tuiles ; l'ouverture d'une tuile affiche son
   panneau.

## Structure d'une tuile

```json
{
  "id": "realisations",
  "type": "gallery",
  "icone": "handshake",
  "libelle": "Réalisations",
  "description": "Nos projets",
  "enabled": true
}
```

- `id` : identifiant stable du panneau.
- `type` : `welcome`, `team`, `gallery`, `contact` ou `text` (alias acceptés).
- `icone` : nom d'icône du registre, sinon icône de repli.
- `libelle` : texte affiché sur la tuile.
- `description` : sous-titre de la tuile.
- `enabled` : `false` masque la tuile.
- `title`, `text`, `image` : surcharges optionnelles du panneau.

Maximum 8 tuiles. Si `tuiles_json` est vide/invalide, les 4 tuiles par défaut
sont utilisées. Le petit badge sur « Réalisations » est le nombre de photos de
la photothèque, pas une tuile.

## D'où vient le contenu des panneaux

Chaque stratégie de panneau combine la tuile et les paramètres du template :

| Panneau | Titre | Texte | Images |
| --- | --- | --- | --- |
| `welcome` | `tile.title` sinon `titre_welcome` | `tile.text` sinon `texte_welcome` | `tile.image`, `image_welcome_1`, `image_welcome_2` |
| `team` | `tile.title` sinon `titre_equipe` | `tile.text` sinon `texte_equipe` | `tile.image` sinon `image_equipe` |
| `gallery` | `tile.title` sinon `titre_realisations` | `tile.text` | `tile.image` + photos de `ctx.resources.media` |
| `contact` | `tile.title` sinon `titre_contact` | `tile.text` sinon `texte_contact` | `tile.image` |
| `text` | `tile.title` | `tile.text` | `tile.image` |

La galerie ne contient donc pas des images codées dans la tuile : elle fusionne
les images du panneau et les photos actives de la photothèque exposées par
l'hôte.

## Variables associées

Les paramètres `titre_welcome`, `texte_welcome`, `titre_equipe`, `texte_equipe`,
`titre_realisations`, `titre_contact` et `texte_contact` alimentent les panneaux
**quand la tuile ne définit pas sa propre surcharge**.

`nom_assistant` remplace le nom de l'organisation dans le chat et les
interpolations `{marque}` ; vide, il retombe sur `ctx.brand.name`.
