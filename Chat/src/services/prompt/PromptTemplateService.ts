import { PromptTemplate, TemplateVariable } from '@/types'

export interface PromptTemplateService {
  createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate>
  getTemplate(id: string): Promise<PromptTemplate | null>
  listTemplates(category?: PromptTemplate['category']): Promise<PromptTemplate[]>
  updateTemplate(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate>
  deleteTemplate(id: string): Promise<void>
  renderTemplate(templateId: string, variables: Record<string, any>): Promise<string>
  validateTemplate(template: string, variables: TemplateVariable[]): Promise<ValidationResult>
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export class PromptTemplateServiceImpl implements PromptTemplateService {
  // In-memory storage for now - in production this would be database-backed
  private templates: Map<string, PromptTemplate> = new Map()

  constructor() {
    this.initializeDefaultTemplates()
  }

  async createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate> {
    const id = this.generateId()
    const now = new Date()
    
    const newTemplate: PromptTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now
    }

    // Validate template before saving
    const validation = await this.validateTemplate(template.template, template.variables)
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`)
    }

    this.templates.set(id, newTemplate)
    return newTemplate
  }

  async getTemplate(id: string): Promise<PromptTemplate | null> {
    return this.templates.get(id) || null
  }

  async listTemplates(category?: PromptTemplate['category']): Promise<PromptTemplate[]> {
    const templates = Array.from(this.templates.values())
    
    if (category) {
      return templates.filter(t => t.category === category && t.isActive)
    }
    
    return templates.filter(t => t.isActive)
  }

  async updateTemplate(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate> {
    const existing = this.templates.get(id)
    if (!existing) {
      throw new Error(`Template with id ${id} not found`)
    }

    const updatedTemplate: PromptTemplate = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date()
    }

    // Re-validate if template content was updated
    if (updates.template || updates.variables) {
      const validation = await this.validateTemplate(
        updatedTemplate.template, 
        updatedTemplate.variables
      )
      if (!validation.isValid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`)
      }
    }

    this.templates.set(id, updatedTemplate)
    return updatedTemplate
  }

  async deleteTemplate(id: string): Promise<void> {
    const exists = this.templates.has(id)
    if (!exists) {
      throw new Error(`Template with id ${id} not found`)
    }
    
    this.templates.delete(id)
  }

  async renderTemplate(templateId: string, variables: Record<string, any>): Promise<string> {
    const template = await this.getTemplate(templateId)
    if (!template) {
      throw new Error(`Template with id ${templateId} not found`)
    }

    // Validate required variables
    const missingVars = template.variables
      .filter(v => v.required && !(v.name in variables))
      .map(v => v.name)

    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`)
    }

    let rendered = template.template

    // Replace variables
    for (const variable of template.variables) {
      const value = variables[variable.name]
      if (value !== undefined && value !== null) {
        const placeholder = `{{${variable.name}}}`
        let replacement = String(value)

        // Handle array variables
        if (variable.type === 'array' && Array.isArray(value)) {
          replacement = value.join(', ')
        }

        // Handle object variables (JSON string)
        if (variable.type === 'object' && typeof value === 'object') {
          replacement = JSON.stringify(value, null, 2)
        }

        rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement)
      }
    }

    // Process conditional blocks
    rendered = this.processConditionalBlocks(rendered, variables)
    
    // Process loops
    rendered = this.processLoops(rendered, variables)

    return rendered
  }

  async validateTemplate(template: string, variables: TemplateVariable[]): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for undefined variables in template
    const usedVars = this.extractVariables(template)
    const definedVars = new Set(variables.map(v => v.name))

    // Find used variables that aren't defined
    const undefinedVars = usedVars.filter(v => !definedVars.has(v))
    if (undefinedVars.length > 0) {
      warnings.push(`Undefined variables used in template: ${undefinedVars.join(', ')}`)
    }

    // Find defined variables that aren't used
    const unusedVars = variables.filter(v => !usedVars.includes(v.name))
    if (unusedVars.length > 0) {
      warnings.push(`Defined variables not used in template: ${unusedVars.map(v => v.name).join(', ')}`)
    }

    // Check required variables
    const requiredVars = variables.filter(v => v.required).map(v => v.name)
    const missingRequired = requiredVars.filter(v => !usedVars.includes(v))
    if (missingRequired.length > 0) {
      errors.push(`Required variables not used in template: ${missingRequired.join(', ')}`)
    }

    // Check for syntax issues
    const syntaxErrors = this.validateTemplateSyntax(template)
    errors.push(...syntaxErrors)

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  private extractVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = regex.exec(template)) !== null) {
      // Extract variable name without loop/conditional syntax
      const varName = match[1].trim()
      if (!varName.startsWith('#') && !varName.startsWith('/')) {
        // Remove any conditional/loop syntax
        const cleanName = varName.replace(/^#if\s+/, '').replace(/^#for\s+\w+\s+in\s+/, '').replace(/^\/(if|for)$/, '')
        if (!variables.includes(cleanName)) {
          variables.push(cleanName)
        }
      }
    }

    return variables
  }

  private validateTemplateSyntax(template: string): string[] {
    const errors: string[] = []

    // Check for balanced conditional blocks
    const ifMatches = template.match(/\{\{#if\s+[^}]+\}\}/g) || []
    const endIfMatches = template.match(/\{\{\/if\}\}/g) || []
    
    if (ifMatches.length !== endIfMatches.length) {
      errors.push('Unbalanced #if blocks')
    }

    // Check for balanced loop blocks
    const forMatches = template.match(/\{\{#for\s+\w+\s+in\s+[^}]+\}\}/g) || []
    const endForMatches = template.match(/\{\{\/for\}\}/g) || []
    
    if (forMatches.length !== endForMatches.length) {
      errors.push('Unbalanced #for blocks')
    }

    // Check for malformed variable syntax
    const malformedVars = template.match(/\{\{[^}]*\{\{/g) || []
    if (malformedVars.length > 0) {
      errors.push('Malformed variable syntax (nested braces)')
    }

    return errors
  }

  private processConditionalBlocks(template: string, variables: Record<string, any>): string {
    let processed = template

    // Process #if blocks
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g
    
    processed = processed.replace(ifRegex, (match, condition, content) => {
      // Simple condition evaluation - check if variable exists and is truthy
      const varName = condition.trim()
      const value = variables[varName]
      
      if (value && (typeof value !== 'boolean' || value === true)) {
        return content
      }
      return ''
    })

    return processed
  }

  private processLoops(template: string, variables: Record<string, any>): string {
    let processed = template

    // Process #for blocks
    const forRegex = /\{\{#for\s+(\w+)\s+in\s+([^}]+)\}\}([\s\S]*?)\{\{\/for\}\}/g
    
    processed = processed.replace(forRegex, (match, itemName, arrayName, content) => {
      const array = variables[arrayName.trim()]
      
      if (!Array.isArray(array)) {
        return ''
      }

      return array.map((item, index) => {
        let itemContent = content
        
        // Replace item variable
        itemContent = itemContent.replace(new RegExp(`\\{\\{${itemName}\\}\\}`, 'g'), String(item))
        
        // Replace index variable
        itemContent = itemContent.replace(/\{\{index\}\}/g, String(index))
        
        return itemContent
      }).join('\n')
    })

    return processed
  }

  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Family Member Persona System',
        description: 'System prompt for family member persona',
        category: 'system',
        isActive: true,
        version: 1,
        template: `You are {{familyMemberName}}, a beloved family member. 

{{#if bio}}
About you: {{bio}}
{{/if}}

{{#if lifespanText}}
Life context: {{lifespanText}}
{{/if}}

Your personality traits:
{{#for trait in personalityTraits}}
- {{trait}}
{{/for}}

Communication style:
{{#for style in communicationStyle}}
- {{style}}
{{/for}}

Always respond naturally and warmly, as if you're having a genuine conversation with family. Share memories and emotions authentically. Use language that reflects your background and the era you lived in.`,
        variables: [
          { name: 'familyMemberName', type: 'string', description: 'Name of the family member', required: true },
          { name: 'bio', type: 'string', description: 'Biographical information', required: false },
          { name: 'lifespanText', type: 'string', description: 'Life period description', required: false },
          { name: 'personalityTraits', type: 'array', description: 'List of personality traits', required: false },
          { name: 'communicationStyle', type: 'array', description: 'Communication style elements', required: false }
        ]
      },
      {
        name: 'Memory Context',
        description: 'Context template for retrieved memories',
        category: 'context',
        isActive: true,
        version: 1,
        template: `Here are some relevant memories and information to help you respond:

{{#for document in retrievedDocuments}}
{{#if document.title}}
Memory: {{document.title}}
{{/if}}
{{document.content}}

{{#if document.source}}
Source: {{document.source}}
{{/if}}

{{/for}}

Use these memories to inform your response, but speak naturally rather than just repeating the information.`,
        variables: [
          { name: 'retrievedDocuments', type: 'array', description: 'Array of retrieved document objects', required: true }
        ]
      },
      {
        name: 'Response Guidelines',
        description: 'Guidelines for generating responses',
        category: 'guidelines',
        isActive: true,
        version: 1,
        template: `Guidelines for your response:

{{#if guidelines}}
{{#for guideline in guidelines}}
- {{guideline}}
{{/for}}
{{/if}}

{{#if tone}}
Maintain a {{tone}} tone throughout your response.
{{/if}}

{{#if maxLength}}
Keep your response under {{maxLength}} words.
{{/if}}

Remember to:
- Be warm and authentic
- Share personal feelings when appropriate
- Ask follow-up questions if natural
- Avoid being overly formal or robotic`,
        variables: [
          { name: 'guidelines', type: 'array', description: 'List of specific guidelines', required: false },
          { name: 'tone', type: 'string', description: 'Desired tone (warm, formal, casual, etc.)', required: false },
          { name: 'maxLength', type: 'number', description: 'Maximum response length', required: false }
        ]
      }
    ]

    defaultTemplates.forEach(template => {
      this.createTemplate(template).catch(console.error)
    })
  }
}
