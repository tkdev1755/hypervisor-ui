/**
 * La réponse simple de l'API (ping, erreurs) : { "status": "...", "content": "..." }.
 *
 * Une « interface » TypeScript décrit la forme d'un objet : la liste de ses
 * champs et le type de chacun. Elle n'existe que pour vérifier le code ; elle
 * disparaît une fois le code compilé.
 */
export interface ApiMessage {
  status: string;
  content: string;
}
