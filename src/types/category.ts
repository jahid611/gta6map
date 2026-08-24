/**
 * Groupes de catégories :
 *  - `landmark` : lieux identifiés par la communauté (bâtiments, monuments...)
 *  - `gameplay` : contenu de jeu (collectibles, véhicules, armes, missions, easter eggs)
 */
export type CategoryGroup = "media" | "landmark" | "gameplay";

export interface Category {
  /** Identifiant stable, utilisé en URL et comme clé de filtre. */
  slug: string;
  name: string;
  description: string | null;
  group: CategoryGroup;
  /** Nom d'icône Lucide (PascalCase, ex. `Hotel`). */
  icon: string;
  /** Couleur hexadécimale `#rrggbb`. */
  color: string;
  sortOrder: number;
  /** `true` si les éléments de cette catégorie comptent dans la complétion. */
  trackable: boolean;
}

export interface CategoryWithCount extends Category {
  /** Nombre total de lieux dans la catégorie. */
  total: number;
  /** Nombre de lieux trouvés par l'utilisateur. */
  found: number;
}
