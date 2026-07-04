import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Code, Play, Loader2, Terminal, PartyPopper, Zap, Braces } from 'lucide-react'
import { runCode, isPythonReady } from '../features/playground/runners'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import Confetti from '../components/ui/Confetti'

const STARTERS = {
  python: `# Python Playground\n# Print a greeting and add some numbers!\n\nname = "Hero"\nprint("Hello, " + name + "!")\nprint("2 + 3 =", 2 + 3)\n`,
  javascript: `// JavaScript Playground\n// Print a greeting and add some numbers!\n\nconst name = "Hero";\nconsole.log("Hello, " + name + "!");\nconsole.log("2 + 3 =", 2 + 3);\n`,
}

export default function Playground() {
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState(STARTERS.python)
  const [output, setOutput] = useState([])
  const [errorOut, setErrorOut] = useState('')
  const [ran, setRan] = useState(false)
  const [reward, setReward] = useState(false)
  const [xpBurst, setXpBurst] = useState(false)
  const [running, setRunning] = useState(false)
  // First-run only: the Python (Pyodide/WASM) engine downloads from the CDN.
  const [loadingPython, setLoadingPython] = useState(false)

  const switchLang = (lang) => {
    setLanguage(lang)
    setCode(STARTERS[lang])
    setOutput([])
    setErrorOut('')
    setRan(false)
  }

  const handleRun = async () => {
    setOutput([])
    setErrorOut('')
    setRan(false)
    setRunning(true)
    // Only Python needs a one-time engine download; JS runs instantly.
    const needsPythonLoad = language === 'python' && !isPythonReady()
    if (needsPythonLoad) setLoadingPython(true)
    try {
      const result = await runCode({ language, code })
      const text = (result.stdout ?? '').toString() || result.output || ''
      const lines = text.split('\n').filter((l, i, arr) => l !== '' || i < arr.length - 1)
      setOutput(lines.length ? lines : ['Program ran successfully (no output).'])
      setErrorOut((result.stderr ?? '').toString())
      setRan(true)
      // Celebrate a clean run: real output produced and no error text.
      const success = !result.stderr && text.trim().length > 0
      if (success) {
        setReward(true)
        setXpBurst(true)
        setTimeout(() => setReward(false), 2500)
        setTimeout(() => setXpBurst(false), 1500)
      }
    } catch (err) {
      setRan(true)
      // PyodideLoadError = CDN unreachable / offline; anything else is unexpected.
      setErrorOut(
        err?.name === 'PyodideLoadError'
          ? "Couldn't load the Python engine — check your connection and try again."
          : err?.message || 'Could not run your code. Please try again.'
      )
    } finally {
      setRunning(false)
      setLoadingPython(false)
    }
  }

  return (
    <PageTransition>
      {reward && <Confetti pieces={70} />}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading flex items-center gap-2 text-3xl font-extrabold">
            <AnimatedIcon icon={Code} size={28} animation="float" className="text-turmeric" glow />
            Code Playground
          </h1>
          <p className="text-text-secondary">Write real code, hit run, see real output!</p>
        </div>
        <div className="flex items-center gap-2">
          <LangButton active={language === 'python'} onClick={() => switchLang('python')}>
            <AnimatedIcon icon={Code} size={16} animation="hover" />
            Python
          </LangButton>
          <LangButton active={language === 'javascript'} onClick={() => switchLang('javascript')}>
            <AnimatedIcon icon={Braces} size={16} animation="hover" />
            JavaScript
          </LangButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <Card hover={false} className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-k-border px-4 py-2">
            <span className="game-text text-sm text-text-secondary">main.{language === 'python' ? 'py' : 'js'}</span>
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-error" />
              <span className="h-3 w-3 rounded-full bg-accent" />
              <span className="h-3 w-3 rounded-full bg-success" />
            </div>
          </div>
          <Editor
            height="380px"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v ?? '')}
            options={{
              fontSize: 15,
              minimap: { enabled: false },
              padding: { top: 16 },
              fontFamily: 'Fira Code, monospace',
              scrollBeyondLastLine: false,
              roundedSelection: true,
            }}
          />
        </Card>

        {/* Output */}
        <Card hover={false} className="relative flex flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-k-border px-4 py-2">
            <span className="game-text flex items-center gap-1.5 text-sm text-text-secondary">
              <AnimatedIcon icon={Terminal} size={16} animation="none" className="text-text-secondary" />
              Output
            </span>
            <Button size="sm" onClick={handleRun} disabled={running} className="flex items-center gap-1.5">
              <AnimatedIcon icon={running ? Loader2 : Play} size={16} animation={running ? 'spin' : 'hover'} />
              {loadingPython ? 'Loading Python…' : running ? 'Running…' : 'Run Code'}
            </Button>
          </div>
          <div className="scrollbar-thin min-h-[380px] flex-1 overflow-auto bg-malt/80 p-4 font-mono text-sm">
            {!ran && !running && (
              <p className="flex items-center gap-1.5 text-text-secondary/60">
                <AnimatedIcon icon={Play} size={14} animation="none" className="text-text-secondary/60" />
                Output will appear here. Press Run.
              </p>
            )}
            {loadingPython && (
              <p className="flex items-center gap-1.5 text-turmeric">
                <AnimatedIcon icon={Loader2} size={14} animation="spin" className="text-turmeric" />
                Loading Python… (first run downloads the engine)
              </p>
            )}
            {running && !loadingPython && (
              <p className="text-turmeric">Running in the browser sandbox…</p>
            )}
            {!running && output.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="text-success"
              >
                <span className="mr-2 text-text-secondary/50">›</span>
                {line}
              </motion.div>
            ))}
            {!running && errorOut && (
              <pre className="mt-2 whitespace-pre-wrap text-error">{errorOut}</pre>
            )}

            <AnimatePresence>
              {xpBurst && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.6 }}
                  animate={{ opacity: 1, y: -10, scale: 1 }}
                  exit={{ opacity: 0, y: -40 }}
                  className="game-text mt-4 inline-flex items-center gap-1.5 rounded-full bg-turmeric px-4 py-1 font-bold text-malt shadow-golden-glow"
                >
                  Nice run!
                  <AnimatedIcon icon={Zap} size={16} animation="pop" className="text-malt" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {reward && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit rounded-2xl border-2 border-turmeric bg-card px-6 py-4 text-center shadow-golden-glow"
              >
                <div className="flex justify-center">
                  <AnimatedIcon icon={PartyPopper} size={40} animation="pop" className="text-turmeric" glow />
                </div>
                <p className="game-text font-bold text-turmeric">Great job, hero!</p>
                <p className="text-xs text-text-secondary">Your code ran cleanly.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </PageTransition>
  )
}

function LangButton({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={`game-text inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition-[background-color,border-color,color,box-shadow] duration-200 ${
        active ? 'bg-turmeric text-malt shadow-golden-glow' : 'border border-k-border bg-surface/60 text-text-secondary hover:text-turmeric'
      }`}
    >
      {children}
    </button>
  )
}
