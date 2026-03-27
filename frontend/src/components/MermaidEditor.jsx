import React, { useState, useEffect, useRef, useCallback } from 'react'
import mermaid from 'mermaid'
import { Edit2, Save } from 'lucide-react'
import html2canvas from 'html2canvas'

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
        return 'graph TD\n    A[Flowchart unavailable] --> B[Please regenerate or edit diagram]'
    }
    return code
}

function injectSafeSvg(container, svgMarkup) {
    const parser = new DOMParser()
    const cleanedSvg = String(svgMarkup || '').replace(/<br>/gi, '<br/>')
    const svgDoc = parser.parseFromString(cleanedSvg, 'image/svg+xml')
    const svgElement = svgDoc.documentElement

    if (!svgElement || svgElement.nodeName.toLowerCase() === 'parsererror') {
        throw new Error('Unable to render SVG output')
    }

    svgElement.querySelectorAll('script, foreignObject').forEach((node) => node.remove())
    container.replaceChildren(svgElement)
}

export default function MermaidEditor({ code, onSave, readOnly = false }) {
    const [isEditing, setIsEditing] = useState(false)
    const [currentCode, setCurrentCode] = useState(code)
    const [error, setError] = useState(null)
    const graphRef = useRef(null)

    useEffect(() => {
        setCurrentCode(code)
    }, [code])

    const renderDiagram = useCallback(async () => {
        if (!graphRef.current) return;
        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                securityLevel: 'strict',
                flowchart: {
                    htmlLabels: false,
                },
            })
            const safeCode = normalizeMermaidCode(currentCode)
            const { svg } = await mermaid.render('mermaid-svg-' + Math.random().toString(36).substr(2, 9), safeCode)
            injectSafeSvg(graphRef.current, svg)
            setError(null)
        } catch (e) {
            console.error("Mermaid Error:", e)
            setError("Flowchart render failed. Please edit or regenerate the diagram.")
            // Make sure the error doesn't break the UI permanently
            // Mermaid often leaves the DOM in a bad state on error
        }
    }, [currentCode])

    useEffect(() => {
        if (!isEditing) {
            renderDiagram()
        }
    }, [currentCode, isEditing, renderDiagram])

    const handleDownload = async (format) => {
        if (!graphRef.current) return;
        try {
            const svgElement = graphRef.current.querySelector('svg');
            if (!svgElement) return;

            // Option 1: HTML2Canvas (Raster)
            const canvas = await html2canvas(graphRef.current, {
                backgroundColor: '#1a1a1a',
                scale: 3 // High res
            });
            const link = document.createElement('a');
            link.download = `flowchart.${format}`;
            link.href = canvas.toDataURL(`image/${format}`);
            link.click();
        } catch (e) {
            console.error("Export Failed", e)
            alert("Export failed: " + e.message)
        }
    }

    if (isEditing) {
        return (
            <div className="flex flex-col h-full bg-[#1e1e1e] rounded-lg border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between p-2 bg-[#252525] border-b border-white/5">
                    <span className="text-xs font-mono text-gray-400">Mermaid Code Editor</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setIsEditing(false)
                                onSave(currentCode)
                            }}
                            className="p-1 px-3 bg-green-500/20 text-green-400 text-xs rounded hover:bg-green-500/30 flex items-center gap-1"
                        >
                            <Save size={14} /> Save & View
                        </button>
                    </div>
                </div>
                <textarea
                    value={currentCode}
                    onChange={(e) => setCurrentCode(e.target.value)}
                    className="flex-1 w-full bg-[#1e1e1e] text-green-400 font-mono text-sm p-4 outline-none resize-none"
                    spellCheck={false}
                />
            </div>
        )
    }

    return (
        <div className="relative flex flex-col h-full w-full">
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                {!readOnly && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 bg-[#2a2a2a]/80 backdrop-blur rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all shadow-lg"
                        title="Edit Code"
                    >
                        <Edit2 size={16} />
                    </button>
                )}
                <div className="flex bg-[#2a2a2a]/80 backdrop-blur rounded-lg border border-white/10 overflow-hidden shadow-lg">
                    <button
                        onClick={() => handleDownload('png')}
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/5 transition-colors"
                        title="Download PNG"
                    >
                        <span className="text-xs font-bold">PNG</span>
                    </button>
                    <div className="w-[1px] bg-white/10"></div>
                    <button
                        onClick={() => handleDownload('jpeg')}
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/5 transition-colors"
                        title="Download JPEG"
                    >
                        <span className="text-xs font-bold">JPG</span>
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 w-full h-full overflow-auto flex items-center justify-center bg-[#111] p-8" id="mermaid-container">
                {error ? (
                    <div className="text-red-400 font-mono text-sm border-l-2 border-red-500 pl-4">
                        {error}
                        <br />
                        <button onClick={() => setIsEditing(true)} className="text-white underline mt-2">Edit to fix</button>
                    </div>
                ) : (
                    <div ref={graphRef} className="w-full h-full flex items-center justify-center" />
                )}
            </div>
        </div>
    )
}
