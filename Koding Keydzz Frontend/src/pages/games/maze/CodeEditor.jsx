import { Suspense, lazy, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

// Lazy-load Monaco so it only ships when a kid actually opens a maze level.
const Editor = lazy(() => import('@monaco-editor/react'))

// Ember-tuned dark theme registered once, on first mount.
function defineEmberTheme(monaco) {
  monaco.editor.defineTheme('kk-ember', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'FF602F', fontStyle: 'bold' }, // for / in / range
      { token: 'identifier', foreground: 'EAF2F5' },
      { token: 'number', foreground: '34D399' },
      { token: 'comment', foreground: '9DB8C4', fontStyle: 'italic' },
      { token: 'delimiter.parenthesis', foreground: 'FF6A3D' },
    ],
    colors: {
      'editor.background': '#001621',
      'editor.foreground': '#EAF2F5',
      'editorLineNumber.foreground': '#3A5663',
      'editorLineNumber.activeForeground': '#FF602F',
      'editor.lineHighlightBackground': '#0A2E3C66',
      'editor.selectionBackground': '#FF602F33',
      'editorCursor.foreground': '#FF602F',
      'editorIndentGuide.background': '#0A2E3C',
      'editorIndentGuide.activeBackground': '#1f4453',
    },
  })
}

const Fallback = (
  <div className="flex h-full min-h-[260px] items-center justify-center gap-2 bg-malt text-text-secondary">
    <Loader2 size={18} className="animate-spin text-turmeric" />
    <span className="game-text text-sm">Loading editor…</span>
  </div>
)

/**
 * CodeEditor — a thin, Ember-themed Monaco wrapper for the maze.
 *
 * Props:
 *   value, onChange, onMount?, readOnly?, height?
 */
export default function CodeEditor({ value, onChange, onMount, readOnly = false, height = '320px' }) {
  const handleBeforeMount = useCallback((monaco) => {
    defineEmberTheme(monaco)
  }, [])

  return (
    <Suspense fallback={Fallback}>
      <Editor
        height={height}
        language="python"
        theme="kk-ember"
        value={value}
        beforeMount={handleBeforeMount}
        onMount={onMount}
        onChange={(v) => onChange(v ?? '')}
        loading={Fallback}
        options={{
          fontSize: 15,
          minimap: { enabled: false },
          padding: { top: 14, bottom: 14 },
          fontFamily: 'Fira Code, monospace',
          scrollBeyondLastLine: false,
          roundedSelection: true,
          lineNumbersMinChars: 3,
          tabSize: 4,
          insertSpaces: true,
          renderLineHighlight: 'line',
          overviewRulerLanes: 0,
          scrollbar: { vertical: 'auto', horizontalScrollbarSize: 8, verticalScrollbarSize: 8 },
          readOnly,
          'semanticHighlighting.enabled': true,
        }}
      />
    </Suspense>
  )
}
