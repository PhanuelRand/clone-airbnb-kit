import { serve } from '@hono/node-server'
import { Hono } from 'hono'

/**
 * Le point d'entrée de votre API.
 *
 * Il ne fait presque rien pour l'instant : une seule route, qui répond que le
 * serveur est en vie. C'est volontaire. Tout le reste, vous l'écrivez.
 *
 * La route `/sante` a pourtant une raison d'être dès maintenant : la
 * vérification du module 9 l'interroge sur votre déploiement pour établir que
 * votre application tourne vraiment. Gardez-la, où que vous rangiez le reste.
 */
const app = new Hono()

app.get('/sante', (c) => c.json({ statut: 'ok' }))

// Votre front tourne sur une autre adresse que votre API. Le navigateur refuse
// alors les appels, sauf si l'API dit explicitement qui a le droit de
// l'interroger. C'est ce qu'on appelle le partage de ressources entre origines.
// Vous vous en occuperez au module où votre première page appellera l'API.

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, () => {
  console.log(`API à l'écoute sur http://localhost:${port}`)
})

export { app }
