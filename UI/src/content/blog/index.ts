import { ReactNode } from 'react'
import { PreserveFamilyVoicesPost } from './preserve-family-voices-before-its-too-late'
import { OpenSourceFamilyMemoriesPost } from './why-open-source-matters-for-family-memories'
import { AiVoiceCloningEthicsPost } from './ai-voice-cloning-ethics-family-consent'
import { HowToPreserveFamilyMemoriesDigitally } from './how-to-preserve-family-memories-digitally'
import { RecordGrandparentsVoicesPost } from './record-grandparents-voices-before-stories-go-quiet'

export interface BlogPostMeta {
  slug: string
  title: string
  date: string
  excerpt: string
  tags: string[]
  author: {
    name: string
    avatar?: string
    bio?: string
  }
  readTime: string
  coverImage?: string
}

export interface BlogPost extends BlogPostMeta {
  content: () => ReactNode
}

/**
 * All blog posts registry.
 *
 * To add a new post:
 * 1. Create the post file in this directory (e.g. `my-post-slug.tsx`)
 * 2. Export `meta` (BlogPostMeta shape) and `BlogContent` (a React functional component)
 * 3. Export a bundled object: `export const MyPost = { meta, content: BlogContent } as const`
 * 4. Import it here and add to the array below
 */
export const blogPosts: BlogPost[] = [
  {
    slug: PreserveFamilyVoicesPost.meta.slug,
    title: PreserveFamilyVoicesPost.meta.title,
    date: PreserveFamilyVoicesPost.meta.date,
    excerpt: PreserveFamilyVoicesPost.meta.excerpt,
    tags: PreserveFamilyVoicesPost.meta.tags,
    author: PreserveFamilyVoicesPost.meta.author,
    readTime: PreserveFamilyVoicesPost.meta.readTime,
    content: PreserveFamilyVoicesPost.content,
  },
  {
    slug: OpenSourceFamilyMemoriesPost.meta.slug,
    title: OpenSourceFamilyMemoriesPost.meta.title,
    date: OpenSourceFamilyMemoriesPost.meta.date,
    excerpt: OpenSourceFamilyMemoriesPost.meta.excerpt,
    tags: OpenSourceFamilyMemoriesPost.meta.tags,
    author: OpenSourceFamilyMemoriesPost.meta.author,
    readTime: OpenSourceFamilyMemoriesPost.meta.readTime,
    content: OpenSourceFamilyMemoriesPost.content,
  },
  {
    slug: AiVoiceCloningEthicsPost.meta.slug,
    title: AiVoiceCloningEthicsPost.meta.title,
    date: AiVoiceCloningEthicsPost.meta.date,
    excerpt: AiVoiceCloningEthicsPost.meta.excerpt,
    tags: AiVoiceCloningEthicsPost.meta.tags,
    author: AiVoiceCloningEthicsPost.meta.author,
    readTime: AiVoiceCloningEthicsPost.meta.readTime,
    content: AiVoiceCloningEthicsPost.content,
  },
  {
    slug: HowToPreserveFamilyMemoriesDigitally.meta.slug,
    title: HowToPreserveFamilyMemoriesDigitally.meta.title,
    date: HowToPreserveFamilyMemoriesDigitally.meta.date,
    excerpt: HowToPreserveFamilyMemoriesDigitally.meta.excerpt,
    tags: HowToPreserveFamilyMemoriesDigitally.meta.tags,
    author: HowToPreserveFamilyMemoriesDigitally.meta.author,
    readTime: HowToPreserveFamilyMemoriesDigitally.meta.readTime,
    content: HowToPreserveFamilyMemoriesDigitally.content,
  },
  {
    slug: RecordGrandparentsVoicesPost.meta.slug,
    title: RecordGrandparentsVoicesPost.meta.title,
    date: RecordGrandparentsVoicesPost.meta.date,
    excerpt: RecordGrandparentsVoicesPost.meta.excerpt,
    tags: RecordGrandparentsVoicesPost.meta.tags,
    author: RecordGrandparentsVoicesPost.meta.author,
    readTime: RecordGrandparentsVoicesPost.meta.readTime,
    content: RecordGrandparentsVoicesPost.content,
  },
]

/** Lookup post by slug */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}

/** Get related posts by matching tags (excluding current slug) */
export function getRelatedPosts(slug: string, max = 3): BlogPostMeta[] {
  const current = getPostBySlug(slug)
  if (!current) return []

  const candidates = blogPosts.filter((p) => p.slug !== slug)

  // Score by matching tags
  const scored = candidates.map((p) => {
    const matchingTags = p.tags.filter((t) => current.tags.includes(t))
    return { ...p, score: matchingTags.length }
  })

  return scored
    .filter((p) => (p as any).score > 0)
    .sort((a, b) => (b as any).score - (a as any).score)
    .slice(0, max)
}

/** Get all unique tags across all posts, sorted by frequency */
export function getAllTags(): { tag: string; count: number }[] {
  const tagMap = new Map<string, number>()
  blogPosts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
    })
  })
  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}
