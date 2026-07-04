import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * useGsap — runs a GSAP setup callback inside a gsap.context scoped to a ref.
 * Automatically reverts animations and kills ScrollTriggers on unmount.
 *
 * @param {(ctx: { self: gsap.Context, scope: HTMLElement }) => void} setup
 * @param {Array} deps
 * @returns {React.MutableRefObject}
 */
export function useGsap(setup, deps = []) {
  const scope = useRef(null)

  useLayoutEffect(() => {
    if (!scope.current) return
    const ctx = gsap.context((self) => {
      setup({ self, scope: scope.current })
    }, scope)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return scope
}

export { gsap, ScrollTrigger }
