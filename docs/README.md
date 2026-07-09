# Documentation VSP — index

Point d'entrée de la doc de travail. Si vous reprenez le projet, lisez dans cet ordre.

## Par où commencer

1. **`Mission.md`** — pourquoi ce projet, pour qui, le périmètre (ce qui est in/out), les personae. Le « cap ».
2. **`Suivi.md`** — où on en est _aujourd'hui_ : étapes faites / en cours / à venir, heures vs budget, décisions actées. **Le fichier vivant, mis à jour en continu.**
3. **`Domain-model.md`** — comment s'articulent les données et les flux métier. Pour savoir où chercher dans le code.

Puis selon le besoin :

| Vous voulez…                                             | Doc                             |
| -------------------------------------------------------- | ------------------------------- |
| Savoir si une fonctionnalité existe et où elle est codée | `Backlog.md` (catalogue F1–F20) |
| Écrire de l'UI client sans jargon                        | `UX-glossaire.md` (vocabulaire) |
| Comprendre un parcours utilisateur (admin / client)      | `UX-parcours.md`                |
| Ajouter une source de leads (Facebook, Instagram…)       | `Connecteurs.md`                |
| Refonte data (sites/connecteurs/intégrations/uptime)     | `Refonte-data-architecture.md`  |
| La référence technique (stack, structure, conventions)   | `../CLAUDE.md`                  |

## Rôle de chaque document

| Doc               | Rôle                                                        | Nature                     |
| ----------------- | ----------------------------------------------------------- | -------------------------- |
| `Mission.md`      | Périmètre, objectifs, modules gelés, personae               | Stable (amendé aux jalons) |
| `Suivi.md`        | Avancement, prochaines étapes, heures, journal de décisions | **Vivant**                 |
| `Backlog.md`      | Catalogue exhaustif des fonctionnalités + statut            | Vivant (par feature)       |
| `Domain-model.md` | Entités, FK, flux métier, enums                             | Stable                     |
| `UX-glossaire.md` | Vocabulaire client (anti-jargon)                            | Stable                     |
| `UX-parcours.md`  | Parcours admin & client, états d'écran                      | Stable                     |
| `Connecteurs.md`  | Doc d'extension des connecteurs de leads                    | Stable                     |
| `Roadmap.md`      | Roadmap contractuelle du pack 50h                           | **Figé** (référence)       |

## Sources d'origine

- Maquettes client : `maquette/` (PNG + annotations `*-note.svg`).
- Le contexte de cadrage initial (réunion : pack d'heures, subsidiation, livraison MVP) est résumé dans `Mission.md §1`.

> La règle : `Suivi.md` et `Backlog.md` bougent à chaque chantier. `Mission.md`
> ne bouge qu'aux jalons (et on note pourquoi dans `Suivi.md`). En cas de doute
> sur l'état réel, **le code et `Suivi.md` font foi**, pas les docs de cadrage.
