import axios from 'axios'

export interface Person {
  id: string
  firstName: string
  lastName: string
  fullName: string
  workspaceId: string
}

export class PersonService {
  private uiBaseUrl: string
  private serviceSecret: string

  constructor() {
    this.uiBaseUrl = process.env.UI_BASE_URL || 'http://localhost:4777'
    this.serviceSecret = process.env.CHAT_SERVICE_SECRET || ''
  }

  async getPerson(personId: string, workspaceId: string): Promise<Person | null> {
    try {
      const response = await axios.get(`${this.uiBaseUrl}/api/people/${personId}`, {
        headers: {
          'x-workspace-id': workspaceId,
          'x-user-id': 'system', // Using system user for persona generation
          'x-chat-service-secret': this.serviceSecret
        }
      })

      if (response.data.success) {
        const person = response.data.person
        return {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          fullName: `${person.firstName} ${person.lastName}`,
          workspaceId: person.workspaceId
        }
      }
      return null
    } catch (error) {
      console.error('Failed to fetch person:', error)
      return null
    }
  }
}
