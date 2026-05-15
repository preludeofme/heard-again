import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { personService } from '@/services'
import type { TrimScope } from '@/services/PersonService'

const VALID_SCOPES: TrimScope[] = ['person', 'children', 'all']

function isTrimScope(value: unknown): value is TrimScope {
  return typeof value === 'string' && (VALID_SCOPES as string[]).includes(value)
}

export default apiHandler({
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const personId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const rawScope = req.query.scope
    const scope: TrimScope = isTrimScope(rawScope) ? rawScope : 'all'

    const preview = await personService.getBranchPreview(personId, user.familyspaceId, scope)

    if (preview.people.length === 0) {
      throw Errors.notFound('Person')
    }

    return successResponse(res, preview)
  },
})
