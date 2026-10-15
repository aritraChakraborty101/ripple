/** What the player has selected on the map, shown in the drawer. */
export type Selection =
  | { readonly kind: 'country'; readonly id: string }
  | { readonly kind: 'chokepoint'; readonly id: string }
  | null;
