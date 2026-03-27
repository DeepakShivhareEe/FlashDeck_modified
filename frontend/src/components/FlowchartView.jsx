import React, { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

function injectSafeSvg(container, svgMarkup) {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgMarkup, 'image/svg+xml')
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
})

const FlowchartView = ({ chartCode }) => {
    const containerRef = useRef(null)

    useEffect(() => {
        if (chartCode && containerRef.current) {
            // Unique ID for mermaid to not conflict if multiple charts
            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

            try {
                mermaid.render(id, chartCode).then((result) => {
                    if (containerRef.current) {
                        injectSafeSvg(containerRef.current, result.svg)
                    }
                })
            } catch (err) {
                console.error("Mermaid Render Error:", err)
                if (containerRef.current) {
                    containerRef.current.innerText = "Error rendering flowchart."
                }
            }
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
