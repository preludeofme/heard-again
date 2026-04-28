import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Box, IconButton, ToggleButton, ToggleButtonGroup, Divider, Tooltip } from '@mui/material'
import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  AddPhotoAlternate,
  Undo,
  Redo,
} from '@mui/icons-material'
import { useEffect } from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

const MenuBar = ({ editor, onImageUpload }: { editor: any, onImageUpload: () => void }) => {
  if (!editor) {
    return null
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 1, borderBottom: '1px solid #dcdad5', bgcolor: '#f6f3ee', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
      <ToggleButtonGroup size="small" value={editor.isActive('bold') ? 'bold' : ''}>
        <Tooltip title="Bold">
          <ToggleButton
            value="bold"
            selected={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <FormatBold fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <ToggleButtonGroup size="small" value={editor.isActive('italic') ? 'italic' : ''}>
        <Tooltip title="Italic">
          <ToggleButton
            value="italic"
            selected={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <FormatItalic fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ToggleButtonGroup size="small">
        <Tooltip title="Bullet List">
          <ToggleButton
            value="bulletList"
            selected={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <FormatListBulleted fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Ordered List">
          <ToggleButton
            value="orderedList"
            selected={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <FormatListNumbered fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ToggleButtonGroup size="small">
        <Tooltip title="Blockquote">
          <ToggleButton
            value="blockquote"
            selected={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <FormatQuote fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Insert Image">
        <IconButton size="small" onClick={onImageUpload} sx={{ borderRadius: 1 }}>
          <AddPhotoAlternate fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ flexGrow: 1 }} />

      <IconButton size="small" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo fontSize="small" />
      </IconButton>
    </Box>
  )
}
export const RichTextEditor = ({ content, onChange, placeholder }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'embedded-story-image',
          style: 'max-width: 100%; border-radius: 8px; margin: 16px 0;',
        },
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        style: 'min-height: 200px; padding: 16px; outline: none; font-family: var(--font-newsreader), serif; font-size: 1.1rem; line-height: 1.6;',
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const addImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      if (input.files && input.files[0]) {
        const file = input.files[0]
        
        // In a real app, we would upload the file to the server and get a URL
        // For now, let's use a base64 string or a temporary object URL
        // Since we want this to be persistent, we should probably upload it.
        
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          if (editor) {
            editor.chain().focus().setImage({ src: result }).run()
          }
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  return (
    <Box sx={{ 
      border: '1px solid #dcdad5', 
      borderRadius: 3, 
      bgcolor: '#ffffff',
      '&:hover': { borderColor: '#16334a' },
      '&.Mui-focused': { borderColor: '#16334a', boxShadow: '0 0 0 2px rgba(22, 51, 74, 0.1)' },
      overflow: 'hidden'
    }}>
      <MenuBar editor={editor} onImageUpload={addImage} />
      <EditorContent editor={editor} />
    </Box>
  )
}
