import { NextRequest, NextResponse } from 'next/server'

// DEPRECATED — l'auth OAuth (Google) a été retirée lors de la migration vers PocketBase.
// Route conservée (redirection simple) car la suppression automatique n'était pas possible ;
// peut être supprimée manuellement, ainsi que le dossier app/auth/.
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/login`)
}
