import React, { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

function normalizeMermaidCode(input) {
    let code = String(input || '').replace(/\r/g, '').trim()
    code = code.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/i, '').trim()
    code = code.replace(/<\/?p>/gi, ' ')
    code = code.replace(/<br\s*\/?>/gi, ' ')
    code = code.replace(/\n{3,}/g, '\n\n')

    // Replace empty labels like A[] with visible placeholders.
    let step = 1
    code = code.replace(/\b([A-Za-z0-9_]+)\[\s*\]/g, (_, node) => {
        const label = `Step ${step}`
        step += 1
        return `${node}[${label}]`
    })

    const hasSupportedHeader = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph)\b/i.test(code)
    if (!hasSupportedHeader) {
        return 'graph TD\n    A[Flowchart unavailable] --> B[Please regenerate diagram]'
    }
    return code
}

function injectSafeSvg(container, svgMarkup) {
    const parser = new DOMParser()
    const cleanedSvg = String(svgMarkup || '').replace(/<br>/gi, '<br/>')
    const svgDoc = parser.parseFromString(cleanedSvg, 'image/svg+xml')
    const svgElement = svgDoc.documentElement

    if (!svgElement || svgElement.nodeName.toLowerCase() === 'parsererror') {
        throw new Error('Invalid Mermaid SVG output')
    }

    svgElement.querySelectorAll('script, foreignObject').forEach((node) => node.remove())
    container.replaceChildren(svgElement)
}

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'strict',
    flowchart: {
        htmlLabels: false,
    },
})

const FlowchartView = ({ chartCode }) => {
    const containerRef = useRef(null)

    useEffect(() => {
        if (!chartCode || !containerRef.current) return

        let cancelled = false
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

        ;(async () => {
            try {
                const safeCode = normalizeMermaidCode(chartCode)
                const result = await mermaid.render(id, safeCode)
                if (!cancelled && containerRef.current) {
                    injectSafeSvg(containerRef.current, result.svg)
                }
            } catch (err) {
                console.error("Mermaid Render Error:", err)
                if (!cancelled && containerRef.current) {
                    containerRef.current.innerText = "Error rendering flowchart."
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [chartCode])

    if (!chartCode) return null

    return (
        <div className="w-full overflow-x-auto p-4 bg-[#111] rounded-lg border border-white/10 my-4 flex justify-center">
            <div ref={containerRef} className="mermaid-chart"></div>
        </div>
    )
}

export default FlowchartView
