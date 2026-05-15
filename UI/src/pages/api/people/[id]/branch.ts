import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { personService } from '@/services'
import type { TrimScope, TrimAction } from '@/services/PersonService'

const VALID_SCOPES: TrimScope[] = ['person', 'children', 'all']
const VALID_ACTIONS: TrimAction[] = ['detach', 'delete']

function isTrimScope(value: unknown): value is TrimScope {
  return typeof value === 'string' && (VALID_SCOPES as string[]).includes(value)
}

function isTrimAction(value: unknown): value is TrimAction {
  return typeof value === 'string' && (VALID_ACTIONS as string[]).includes(value)
}

export default apiHandler({
  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const personId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'ADMIN')

    const { scope, action } = req.body as { scope: unknown; action: unknown }

    if (!isTrimScope(scope)) {
      throw Errors.badRequest('Invalid scope. Must be one of: person, children, all')
    }
    if (!isTrimAction(action)) {
      throw Errors.badRequest('Invalid action. Must be one of: detach, delete')
    }

    const result = await personService.trimBranch(personId, user.familyspaceId, scope, action)

    return successResponse(res, result)
  },
})
